import os
from PIL import Image
import cv2
import torch
import torch.multiprocessing as mp
from tqdm import tqdm
from argparse import ArgumentParser
import numpy as np
from segment_anything import (SamAutomaticMaskGenerator, SamPredictor,
                             sam_model_registry)
import math

def process_images(rank, world_size, image_paths, args):
    """Process a subset of images on a specific GPU"""
    # Set the device for this process
    device = f'cuda:{rank}'
    torch.cuda.set_device(rank)
    
    # Initialize SAM model on this GPU
    print(f"Process {rank}: Initializing SAM on {device}...")
    model_type = args.sam_arch
    sam = sam_model_registry[model_type](checkpoint=args.sam_checkpoint_path).to(device)
    
    # Initialize mask generator
    mask_generator = SamAutomaticMaskGenerator(
        model=sam,
        points_per_side=32,
        pred_iou_thresh=0.88,
        box_nms_thresh=0.7,
        stability_score_thresh=0.95,
        crop_n_layers=0,
        crop_n_points_downscale_factor=1,
        min_mask_region_area=100,
    )
    
    # Determine which images this process will handle
    start_idx = rank * len(image_paths) // world_size
    end_idx = (rank + 1) * len(image_paths) // world_size
    process_image_paths = image_paths[start_idx:end_idx]
    
    # Process images
    if rank == 0:  # Only the first process shows the progress bar
        process_iterator = tqdm(process_image_paths, desc=f"GPU {rank} processing")
    else:
        process_iterator = process_image_paths
        
    for path in process_iterator:
        name = path.split('.')[0]
        output_file = os.path.join(args.output_dir, name + '.pt')
        
        # Skip if output already exists
        if os.path.exists(output_file) and not args.overwrite:
            continue
            
        img = cv2.imread(os.path.join(args.image_dir, path))
        if args.downsample_manually:
            img = cv2.resize(img, 
                            dsize=(img.shape[1] // args.downsample, img.shape[0] // args.downsample),
                            fx=1, fy=1, interpolation=cv2.INTER_LINEAR)
        
        # Generate masks
        masks = mask_generator.generate(img)
        
        mask_list = []
        for m in masks:
            m_score = torch.from_numpy(m['segmentation']).float().to(device)

            if args.downsample_type == 'mask':
                m_score = torch.nn.functional.interpolate(
                    m_score.unsqueeze(0).unsqueeze(0), 
                    size=(img.shape[0] // args.downsample, img.shape[1] // args.downsample),
                    mode='bilinear', 
                    align_corners=False
                ).squeeze()
                m_score[m_score >= 0.5] = 1
                m_score[m_score != 1] = 0
                m_score = m_score.bool()

            if len(m_score.unique()) < 2:
                continue
            else:
                mask_list.append(m_score.bool())
                
        if mask_list:
            masks = torch.stack(mask_list, dim=0)
            torch.save(masks.cpu(), output_file)  # Save to CPU to avoid CUDA memory issues
        else:
            # Save empty tensor if no valid masks
            torch.save(torch.zeros((0, img.shape[0], img.shape[1]), dtype=torch.bool), output_file)

if __name__ == '__main__':
    parser = ArgumentParser(description="SAM segment everything masks extracting params")
    
    parser.add_argument("--image_root", default='/datasets/nerf_data/360_v2/garden/', type=str)
    parser.add_argument("--sam_checkpoint_path", default='./third_party/segment-anything/sam_ckpt/sam_vit_h_4b8939.pth', type=str)
    parser.add_argument("--sam_arch", default="vit_h", type=str)
    parser.add_argument("--downsample", default=1, type=int)
    parser.add_argument("--downsample_type", default='image', type=str, choices=['image', 'mask'], help="Downsample then segment, or segment then downsample.")
    parser.add_argument("--num_gpus", type=int, default=torch.cuda.device_count(), help="Number of GPUs to use")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing masks")
    
    args = parser.parse_args()
    
    # Determine image directory
    downsample_manually = False
    if args.downsample == 1 or args.downsample_type == 'mask':
        args.image_dir = os.path.join(args.image_root, 'images')
    else:
        args.image_dir = os.path.join(args.image_root, f'images_{args.downsample}')
        if not os.path.exists(args.image_dir):
            args.image_dir = os.path.join(args.image_root, 'images')
            downsample_manually = True
            print("No downsampled images, will downsample manually.")
    args.downsample_manually = downsample_manually
    
    assert os.path.exists(args.image_dir), "Please specify a valid image root"
    args.output_dir = os.path.join(args.image_root, 'sam_masks')
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Get the list of all images
    image_paths = sorted(os.listdir(args.image_dir))
    
    # Use at most the number of available GPUs
    num_gpus = min(args.num_gpus, torch.cuda.device_count())
    print(f"Using {num_gpus} GPUs for processing {len(image_paths)} images")
    
    if num_gpus == 1:
        # Single GPU processing
        process_images(0, 1, image_paths, args)
    else:
        # Spawn multiple processes for multi-GPU processing
        mp.spawn(
            process_images,
            args=(num_gpus, image_paths, args),
            nprocs=num_gpus,
            join=True
        )
    
    print("All SAM segment everything masks extraction complete!")