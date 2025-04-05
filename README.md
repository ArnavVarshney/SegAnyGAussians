# SAGA: Segment Any 3D GAussians

A cleaner implementation of [SAGA (Segment Any 3D GAussians)](https://arxiv.org/abs/2312.00860), a framework for interactive 3D segmentation using Gaussian Splatting.

## Installation

First, clone the repository:
```bash
git clone https://github.com/ArnavVarshney/SegAnyGAussians.git
cd SegAnyGAussians
```

Set up the environment:
```bash
conda env create --file environment.yml
conda activate saga
```

Download the pre-trained SAM ViT-H model:
```bash
# Download from: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
# Place in ./third_party/segment-anything/sam_ckpt
```

## Workflow

### 1. Pre-train 3D Gaussians
```bash
python train_scene.py -s <path to COLMAP or NeRF Synthetic dataset>
```

### 2. Extract SAM Masks and Scale Information
```bash
python extract_segment_everything_masks.py --image_root <path to scene data> --sam_checkpoint_path <path to SAM model> --downsample <1/2/4/8>
python get_scale.py --image_root <path to scene data> --model_path <path to pre-trained 3DGS model>
```

### 3. Extract CLIP Features (optional, for open-vocabulary segmentation)
```bash
python get_clip_features.py --image_root <path to scene data>
```

### 4. Train 3D Gaussian Affinity Features
```bash
python train_contrastive_feature.py -m <path to pre-trained 3DGS model> --iterations 10000 --num_sampled_rays 1000
```

## Interactive Segmentation

### Using the GUI
```bash
python saga_gui.py --model_path <path to pre-trained 3DGS model>
```
## Rendering Results

### Render Segmented Objects
```bash
python render.py -m <path to pre-trained 3DGS model> --precomputed_mask <path to segmentation results> --target scene --segment
```

## Acknowledgements
This implementation builds upon [GARField](https://github.com/chungmin99/garfield.git), [OmniSeg3D](https://github.com/OceanYing/OmniSeg3D-GS), [SAGA](https://github.com/jumpat/SegAnyGAussians.git), and [Gaussian Splatting](https://github.com/graphdeco-inria/gaussian-splatting).
