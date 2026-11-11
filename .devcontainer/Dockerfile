##############
# Base image #
##############
FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu-22.04
ENV NODE_VERSION=24.22.2

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install --no-install-recommends -y sudo git bash unattended-upgrades curl vim

ENV EDITOR=vim
ARG CONTAINER_USER=vscode

ENV NVM_DIR="/opt/nvm"
RUN mkdir $NVM_DIR
# prepend node to path
ENV PATH="$NVM_DIR/versions/node/v${NODE_VERSION}/bin/:${PATH}"

# install nvm and current node
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}

RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    && mkdir /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R ${CONTAINER_USER} /commandhistory \
    && echo "$SNIPPET" >> "/home/${CONTAINER_USER}/.bashrc"

RUN npx playwright install-deps

USER $CONTAINER_USER

RUN npx playwright install

