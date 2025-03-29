import torch
import os
from tqdm import tqdm
from argparse import ArgumentParser


def identify_all_clusters_with_clip(clusters_root, num_images):
    """
    Use CLIP to identify all rendered cluster objects based on their rendered images

    Args:
        clusters_root: Path to the clusters directory
        num_images: Number of images to process per cluster
    """
    import clip
    from PIL import Image
    import json

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, preprocess = clip.load("ViT-B/32", device=device)
    except Exception as e:
        print(f"Error loading CLIP model: {e}")
        print(
            "Please install CLIP with: pip install git+https://github.com/openai/CLIP.git"
        )
        return

    # Common categories to identify
    categories = [
        "person",
        "man",
        "woman",
        "child",
        "building",
        "house",
        "car",
        "truck",
        "motorcycle",
        "bicycle",
        "chair",
        "sofa",
        "table",
        "desk",
        "bed",
        "plant",
        "tree",
        "flower",
        "lamp",
        "computer",
        "laptop",
        "television",
        "phone",
        "book",
        "bottle",
        "cup",
        "plate",
        "bowl",
        "window",
        "door",
        "floor",
        "wall",
        "ceiling",
        "stairs",
        "grass",
        "road",
        "path",
        "fence",
        "cabinet",
        "shelf",
        "painting",
        "curtain",
        "pillow",
        "rug",
        "clock",
        "vase",
        "sculpture",
    ]

    text = clip.tokenize(["a photo of a " + category for category in categories]).to(
        device
    )

    with torch.no_grad():
        text_features = model.encode_text(text)
        text_features /= text_features.norm(dim=-1, keepdim=True)

    cluster_dirs = sorted(
        [
            int(d)
            for d in os.listdir(clusters_root)
            if os.path.isdir(os.path.join(clusters_root, d))
        ]
    )

    global_info_path = os.path.join(clusters_root, "info.json")
    if not os.path.exists(global_info_path):
        print(f"Global info.json not found at {global_info_path}")
        return

    try:
        with open(global_info_path, "r") as f:
            global_info = json.load(f)
    except Exception as e:
        print(f"Error reading global info.json: {e}")
        return

    for cluster_id in tqdm(cluster_dirs, desc="Identifying clusters with CLIP"):
        cluster_dir = os.path.join(clusters_root, str(cluster_id))

        png_files = [f for f in os.listdir(cluster_dir) if f.endswith(".png")]
        if not png_files:
            print(f"No rendered images found for cluster {cluster_id}")
            continue

        png_paths = [os.path.join(cluster_dir, f) for f in png_files]
        png_paths.sort(key=lambda x: os.path.getsize(x), reverse=True)

        top_pngs = png_paths[: min(num_images, len(png_paths))]

        image_similarities = []
        for img_path in top_pngs:
            try:
                image = preprocess(Image.open(img_path)).unsqueeze(0).to(device)

                with torch.no_grad():
                    image_features = model.encode_image(image)
                    image_features /= image_features.norm(dim=-1, keepdim=True)

                    similarity = (100.0 * image_features @ text_features.T).softmax(
                        dim=-1
                    )
                    image_similarities.append(similarity[0])
            except Exception as e:
                print(f"Error processing {img_path}: {e}")
                continue

        if image_similarities:
            avg_similarity = torch.stack(image_similarities).mean(dim=0)
            values, indices = avg_similarity.topk(3)

            top_classes = []
            for i in range(3):
                top_classes.append(
                    {
                        "class": categories[indices[i]],
                        "probability": float(values[i].item()),
                    }
                )

            for cluster_info in global_info.get("clusters", []):
                if cluster_info.get("cluster_id") == cluster_id:
                    cluster_info["clip_identification"] = top_classes
                    break

    try:
        with open(global_info_path, "w") as f:
            json.dump(global_info, f, indent=2)
        print("Updated global info.json with CLIP identification results")
    except Exception as e:
        print(f"Error saving global info.json: {e}")


if __name__ == "__main__":
    # Set up command line argument parser
    parser = ArgumentParser(description="Testing script parameters")
    parser.add_argument(
        "--clusters_root", default="./segmentation_res/clusters/", type=str
    )
    parser.add_argument(
        "--num_images",
        default=1,
        type=int,
        help="Number of images to process per cluster",
    )

    args = parser.parse_args()

    identify_all_clusters_with_clip(args.clusters_root, args.num_images)
