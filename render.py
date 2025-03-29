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
from scene import Scene, GaussianModel, FeatureGaussianModel
import os
from tqdm import tqdm
from os import makedirs
from gaussian_renderer import render, render_contrastive_feature, render_mask
import torchvision

from utils.general_utils import safe_state
from argparse import ArgumentParser
from arguments import ModelParams, PipelineParams, get_combined_args
from gaussian_renderer import GaussianModel

try:
    from diff_gaussian_rasterization import SparseGaussianAdam

    SPARSE_ADAM_AVAILABLE = True
except:
    SPARSE_ADAM_AVAILABLE = False


def render_set(
    model_path,
    name,
    iteration,
    views,
    gaussians,
    pipeline,
    background,
    train_test_exp,
    separate_sh,
    target,
    precomputed_mask=None,
):
    render_path = os.path.join(model_path, name, "ours_{}".format(iteration), "renders")
    gts_path = os.path.join(model_path, name, "ours_{}".format(iteration), "gt")
    mask_path = os.path.join(model_path, name, "ours_{}".format(iteration), "mask")

    makedirs(render_path, exist_ok=True)
    makedirs(gts_path, exist_ok=True)
    makedirs(mask_path, exist_ok=True)

    for idx, view in enumerate(tqdm(views, desc="Rendering progress")):
        rendering = render(
            view,
            gaussians,
            pipeline,
            background,
            use_trained_exp=train_test_exp,
            separate_sh=separate_sh,
        )["render"]
        gt = view.original_image[0:3, :, :]

        if args.train_test_exp:
            rendering = rendering[..., rendering.shape[-1] // 2 :]
            gt = gt[..., gt.shape[-1] // 2 :]

        torchvision.utils.save_image(
            rendering, os.path.join(render_path, "{0:05d}".format(idx) + ".png")
        )
        torchvision.utils.save_image(
            gt, os.path.join(gts_path, "{0:05d}".format(idx) + ".png")
        )


def render_sets(
    dataset: ModelParams,
    iteration: int,
    pipeline: PipelineParams,
    skip_train: bool,
    skip_test: bool,
    separate_sh: bool,
    segment: bool = False,
    target="scene",
    idx=0,
    precomputed_mask=None,
):
    dataset.need_features = dataset.need_masks = False
    gaussians, feature_gaussians = None, None
    with torch.no_grad():
        if precomputed_mask is not None:
            if ".pt" in precomputed_mask:
                precomputed_mask = torch.load(precomputed_mask)

        gaussians = GaussianModel(dataset.sh_degree)

        scene = Scene(
            dataset,
            gaussians,
            feature_gaussians,
            load_iteration=iteration,
            shuffle=False,
            mode="eval",
            target=target if target != "xyz" and precomputed_mask is None else "scene",
        )

        gaussians.segment(precomputed_mask)

        bg_color = [1, 1, 1] if dataset.white_background else [0, 0, 0]
        background = torch.tensor(bg_color, dtype=torch.float32, device="cuda")

        if not skip_train:
            render_set(
                dataset.model_path,
                "train",
                scene.loaded_iter,
                scene.getTrainCameras(),
                gaussians,
                pipeline,
                background,
                dataset.train_test_exp,
                separate_sh,
                target,
                precomputed_mask=precomputed_mask,
            )

        if not skip_test:
            render_set(
                dataset.model_path,
                "test",
                scene.loaded_iter,
                scene.getTestCameras(),
                gaussians,
                pipeline,
                background,
                dataset.train_test_exp,
                separate_sh,
                target,
                precomputed_mask=precomputed_mask,
            )


if __name__ == "__main__":
    # Set up command line argument parser
    parser = ArgumentParser(description="Testing script parameters")
    model = ModelParams(parser, sentinel=True)
    pipeline = PipelineParams(parser)
    parser.add_argument("--iteration", default=-1, type=int)
    parser.add_argument("--skip_train", action="store_true")
    parser.add_argument("--skip_test", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--segment", action="store_true")
    parser.add_argument(
        "--target",
        default="scene",
        const="scene",
        nargs="?",
        choices=[
            "scene",
            "seg",
            "feature",
            "coarse_seg_everything",
            "contrastive_feature",
            "xyz",
        ],
    )
    parser.add_argument("--idx", default=0, type=int)
    parser.add_argument("--precomputed_mask", default=None, type=str)

    args = get_combined_args(parser)
    print("Rendering " + args.model_path)

    if not hasattr(args, "precomputed_mask"):
        args.precomputed_mask = None
    if args.precomputed_mask is not None:
        print("Using precomputed mask " + args.precomputed_mask)

    args.depths = ""
    args.train_test_exp = False
    # Initialize system state (RNG)
    safe_state(args.quiet)

    render_sets(
        model.extract(args),
        args.iteration,
        pipeline.extract(args),
        args.skip_train,
        args.skip_test,
        SPARSE_ADAM_AVAILABLE,
        args.segment,
        args.target,
        args.idx,
        args.precomputed_mask,
    )
