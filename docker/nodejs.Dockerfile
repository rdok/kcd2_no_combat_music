FROM node:22

RUN apt-get update && apt-get install -y \
    zip \
    wget \
    gnupg \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb

RUN apt-get update && apt-get install -y \
    dotnet-sdk-8.0 \
    dotnet-runtime-7.0 \
    && rm -rf /var/lib/apt/lists/*

RUN dotnet tool install -g Converter.MarkdownToBBCodeNM.Tool
RUN dotnet tool install -g Converter.MarkdownToBBCodeSteam.Tool

ENV PATH="$PATH:/root/.dotnet/tools"

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

ENTRYPOINT ["./docker/nodejs_entrypoint.sh"]