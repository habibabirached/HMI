#!/bin/sh
echo
echo Note: Use this command to run the image as a stand-alone container.
echo Use docker compose to run the app with all its components together.
echo
echo You can test the app by opening the browser: http://localhost:3000
echo 

docker run -p 3000:3000 --name dcs-ui --rm -v $(pwd)/src:/app/src -v $(pwd)/public:/app/public -d dtr.research.ge.com/data_center_simulator/dcs-ui