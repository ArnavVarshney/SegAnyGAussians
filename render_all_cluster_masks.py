#
# Copyright (C) 2023, Inria
# GRAPHDECO research group, https://team.inria.fr/graphdeco
# All rights reserved.
#
# This software is free for non-commercial, research and evaluation use
# under the terms of the LICENSE.md file.
#
# For inquiries contact  george.drettakis@inria.fr
#

import torch
from scene import Scene, GaussianModel
import os
from tqdm import tqdm
from os import makedirs
from gaussian_renderer import old_render, render
import torchvision

from utils.general_utils import safe_state
from argparse import ArgumentParser
from arguments import ModelParams, PipelineParams, get_combined_args
from gaussian_renderer import GaussianModel


def render_clusters(
    dataset: ModelParams,
    iteration: int,
    pipeline: PipelineParams,
    clusters_root=None,
):
    dataset.need_features = dataset.need_masks = False
    gaussians, feature_gaussians = None, None

    with torch.no_grad():
        if not os.path.exists(args.clusters_root):
            print(f"No cluster masks found at {args.clusters_root}.")
            return
        else:
            cluster_dirs = sorted(
                [
                    int(d)
                    for d in os.listdir(args.clusters_root)
                    if os.path.isdir(os.path.join(args.clusters_root, d))
                ]
            )
            if not cluster_dirs:
                print("No cluster directories found.")
                return
            print(
                f"Found {len(cluster_dirs)} cluster masks. Rendering images for each..."
            )

        gaussians = GaussianModel(dataset.sh_degree)

        scene = Scene(
            dataset,
            gaussians,
            feature_gaussians,
            load_iteration=iteration,
            shuffle=False,
            mode="eval",
            target="scene",
        )

        for cluster_id in tqdm(cluster_dirs, desc="Rendering clusters"):
            mask_path = os.path.join(clusters_root, str(cluster_id), "mask.pt")
            if not os.path.exists(mask_path):
                print(f"No mask found for cluster {cluster_id}, skipping...")
                continue

            mask = torch.load(mask_path)
            gaussians.segment(mask)

            bg_color = [1, 1, 1] if dataset.white_background else [0, 0, 0]
            background = torch.tensor(bg_color, dtype=torch.float32, device="cuda")

            for view in scene.getTrainCameras():
                rendering = old_render(
                    view,
                    gaussians,
                    pipeline,
                    background,
                )["render"]

                torchvision.utils.save_image(
                    rendering,
                    os.path.join(
                        clusters_root, str(cluster_id), f"{view.image_name}.png"
                    ),
                )

            gaussians.clear_segment()


if __name__ == "__main__":
    # Set up command line argument parser
    parser = ArgumentParser(description="Testing script parameters")
    model = ModelParams(parser, sentinel=True)
    pipeline = PipelineParams(parser)
    parser.add_argument(
        "--target",
        default="scene",
    )
    parser.add_argument(
        "--clusters_root", default="./segmentation_res/clusters/", type=str
    )

    args = get_combined_args(parser)
    print("Rendering " + args.model_path)

    args.depths = ""
    args.iteration = -1
    args.train_test_exp = False

    render_clusters(
        model.extract(args),
        args.iteration,
        pipeline.extract(args),
        args.clusters_root,
    )
