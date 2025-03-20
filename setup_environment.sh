#!/usr/bin/env bash

if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    . $HOME/miniconda3/etc/profile.d/conda.sh
elif [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
    . $HOME/anaconda3/etc/profile.d/conda.sh
else
    echo "Neither Miniconda nor Anaconda found."
    exit 1
fi

echo "Setting up environment"
conda env create -f environment.yml
conda activate saga

echo "Setting up environment variables"
echo "CONDA_PREFIX: ${CONDA_PREFIX}"
conda env config vars set CUDA_HOME=${CONDA_PREFIX}
conda env config vars set LD_LIBRARY_PATH=${CONDA_PREFIX}/targets/x86_64-linux/lib
conda env config vars set CPATH=${CONDA_PREFIX}/targets/x86_64-linux/include
conda deactivate

echo "Installing pip dependencies"
conda activate saga
for dir in submodules/*/; do
    if [ -f "${dir}setup.py" ]; then
        echo "Installing ${dir}"
        pip install "${dir}"
    fi
done
pip install git+https://github.com/facebookresearch/pytorch3d.git@stable

echo "Installing versioned pip dependencies"
pip install joblib==1.1.0