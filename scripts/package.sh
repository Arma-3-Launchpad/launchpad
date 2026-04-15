#! /bin/bash

# Jump out of scripts and into the root and run `python util.py --build`
cd ../..
python util.py --build
cd scripts
exit 0