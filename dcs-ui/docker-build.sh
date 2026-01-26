#!/bin/sh
echo
echo Note: due to GE proxy, please run it from within Internet to download the base image.
echo Then run it again from within BLUESSO 
echo

#docker pull node:24-alpine
docker build --no-cache -t dtr.research.ge.com/data_center_simulator/dcs-ui .
