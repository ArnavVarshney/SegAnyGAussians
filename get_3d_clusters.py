import os
import time
import json
import torch
import numpy as np
from tqdm import tqdm
from argparse import ArgumentParser
from cuml.cluster.hdbscan import HDBSCAN
from scene import GaussianModel, FeatureGaussianModel


def cluster_3d_points(
    model_path,
    feature_iteration,
    scene_iteration,
    min_cluster_size,
    min_samples,
    cluster_selection_epsilon,
    max_points,
    confidence_threshold,
    output_dir,
):
    """
    Perform 3D clustering on Gaussian point features using HDBSCAN

    Args:
        model_path: Path to the model directory
        feature_iteration: Iteration number for feature point cloud
        scene_iteration: Iteration number for scene point cloud
        min_cluster_size: Minimum cluster size for HDBSCAN
        min_samples: Minimum samples for HDBSCAN
        cluster_selection_epsilon: Epsilon for cluster selection in HDBSCAN
        max_points: Minimum number of points for a valid cluster
        confidence_threshold: Threshold for point-to-cluster assignment confidence
        output_dir: Directory to save clustering results
    """
    # Define paths
    scale_gate_path = os.path.join(
        model_path, f"point_cloud/iteration_{str(feature_iteration)}/scale_gate.pt"
    )
    feature_pcd_path = os.path.join(
        model_path,
        f"point_cloud/iteration_{str(feature_iteration)}/contrastive_feature_point_cloud.ply",
    )
    scene_pcd_path = os.path.join(
        model_path,
        f"point_cloud/iteration_{str(scene_iteration)}/scene_point_cloud.ply",
    )

    # Check if paths exist
    for path in [scale_gate_path, feature_pcd_path, scene_pcd_path]:
        if not os.path.exists(path):
            print(f"Error: {path} does not exist!")
            return

    print("Loading models...")
    # Initialize models
    feature_dim = 32  # Default feature dimension
    gs_model = GaussianModel(3)  # sh_degree=3
    feat_gs_model = FeatureGaussianModel(feature_dim)
    scale_gate = torch.nn.Sequential(
        torch.nn.Linear(1, feature_dim, bias=True), torch.nn.Sigmoid()
    ).cuda()

    # Load models
    gs_model.load_ply(scene_pcd_path)
    feat_gs_model.load_ply(feature_pcd_path)
    scale_gate.load_state_dict(torch.load(scale_gate_path))

    print("Extracting and conditioning features...")
    # Get point features
    point_features = feat_gs_model.get_point_features

    # Apply scale conditioning (using 0.5 as default scale value)
    scale_value = torch.tensor([1.0]).cuda()
    gates = scale_gate(scale_value)
    scale_conditioned_point_features = torch.nn.functional.normalize(
        point_features, dim=-1, p=2
    ) * gates.unsqueeze(0)

    # Normalize features
    normed_point_features = torch.nn.functional.normalize(
        scale_conditioned_point_features, dim=-1, p=2
    )

    # Sample points for clustering (for efficiency)
    print("Sampling points for clustering...")
    sample_mask = torch.rand(scale_conditioned_point_features.shape[0]) > 0.98
    sampled_point_features = scale_conditioned_point_features[sample_mask]
    normed_sampled_point_features = torch.nn.functional.normalize(
        sampled_point_features, dim=-1, p=2
    )

    # Perform clustering
    print("Performing HDBSCAN clustering...")
    start_time = time.time()
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_epsilon=cluster_selection_epsilon,
        allow_single_cluster=False,
    )

    cluster_labels = clusterer.fit_predict(
        normed_sampled_point_features.detach().cpu().numpy()
    )

    # Get unique cluster labels (excluding noise points labeled as -1)
    unique_labels = np.unique(cluster_labels)
    unique_labels = unique_labels[unique_labels >= 0]

    print(f"Found {len(unique_labels)} clusters")
    print(f"Clustering completed in {time.time() - start_time:.2f} seconds")

    # Compute cluster centers
    print("Computing cluster centers...")
    cluster_centers = torch.zeros(
        len(unique_labels), normed_sampled_point_features.shape[-1]
    ).to(normed_point_features.device)

    for i, label in enumerate(unique_labels):
        mask = cluster_labels == label
        if np.sum(mask) > 0:
            cluster_centers[i] = torch.nn.functional.normalize(
                normed_sampled_point_features[mask].mean(dim=0), dim=-1
            )

    # Calculate similarity scores
    print("Calculating similarity scores for all points...")
    similarity_scores = torch.einsum(
        "nc,bc->bn", cluster_centers.cuda(), normed_point_features.cuda()
    )

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.join(output_dir, "clusters"), exist_ok=True)

    # Save each cluster
    print("Saving cluster masks...")
    cluster_assignments = similarity_scores.argmax(dim=-1)

    all_clusters_info = []
    for i, label in enumerate(tqdm(range(len(unique_labels)))):
        cluster_id = int(i)
        cluster_mask = cluster_assignments == i
        confidence = similarity_scores[:, i]

        # Apply confidence threshold
        final_mask = cluster_mask & (confidence > confidence_threshold)
        num_points = final_mask.sum().item()

        if num_points < max_points:
            continue

        cluster_path = os.path.join(output_dir, "clusters", str(cluster_id))
        os.makedirs(cluster_path, exist_ok=True)

        # Save mask
        torch.save(final_mask, os.path.join(cluster_path, "mask.pt"))

        # Save metadata about cluster
        cluster_info = {
            "cluster_id": cluster_id,
            "num_points": num_points,
            "confidence_threshold": confidence_threshold,
            "mask_path": os.path.join(cluster_path, "mask.pt"),
        }
        all_clusters_info.append(cluster_info)

    # Save global clustering information
    global_info = {
        "total_clusters": len(unique_labels),
        "valid_clusters": len(all_clusters_info),
        "min_points_threshold": max_points,
        "confidence_threshold": confidence_threshold,
        "creation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "hdbscan_params": {
            "min_cluster_size": min_cluster_size,
            "min_samples": min_samples,
            "cluster_selection_epsilon": cluster_selection_epsilon,
        },
        "clusters": all_clusters_info,
    }

    with open(os.path.join(output_dir, "clusters", "info.json"), "w") as f:
        json.dump(global_info, f, indent=2)

    print(f"Clustering complete! Results saved to {output_dir}")
    print(
        f"Found {len(all_clusters_info)} valid clusters out of {len(unique_labels)} total clusters"
    )


if __name__ == "__main__":
    parser = ArgumentParser(description="3D clustering of Gaussian point features")
    parser.add_argument(
        "--model_path", type=str, required=True, help="Path to the model directory"
    )
    parser.add_argument(
        "--feature_iteration",
        type=int,
        default=10000,
        help="Iteration number for feature point cloud",
    )
    parser.add_argument(
        "--scene_iteration",
        type=int,
        default=30000,
        help="Iteration number for scene point cloud",
    )
    parser.add_argument(
        "--min_cluster_size",
        type=int,
        default=10,
        help="Minimum cluster size for HDBSCAN",
    )
    parser.add_argument(
        "--min_samples",
        type=int,
        default=5,
        help="Minimum samples parameter for HDBSCAN",
    )
    parser.add_argument(
        "--cluster_selection_epsilon",
        type=float,
        default=0.01,
        help="Epsilon for cluster selection in HDBSCAN",
    )
    parser.add_argument(
        "--max_points",
        type=int,
        default=1000,
        help="Minimum number of points for a valid cluster",
    )
    parser.add_argument(
        "--confidence_threshold",
        type=float,
        default=0.95,
        help="Threshold for point-to-cluster assignment confidence",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="./segmentation_res",
        help="Directory to save clustering results",
    )

    args = parser.parse_args()

    cluster_3d_points(
        args.model_path,
        args.feature_iteration,
        args.scene_iteration,
        args.min_cluster_size,
        args.min_samples,
        args.cluster_selection_epsilon,
        args.max_points,
        args.confidence_threshold,
        args.output_dir,
    )
