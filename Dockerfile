# Set the base image to Ubuntu.
FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y python-software-properties python g++ make software-properties-common
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs

# Bundle source.
COPY . /frankend

# Install NodeJS dependencies.
ENV PORT 1823

WORKDIR /frankend
RUN	npm install

EXPOSE 1823

CMD ["node", "server/server.js"]
