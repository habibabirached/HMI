#!/bin/sh
echo
echo Note: Use this command to run the image as a stand-alone container.
echo Use docker compose to run the app with all its components together.
echo 

docker run  --rm --name dcs-cicd -d dtr.research.ge.com/data_center_simulator/dcs-cicd