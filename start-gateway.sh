#!/bin/bash
# JLC Bridge Gateway — 启动脚本
cd "$(dirname "$0")"
echo "Starting JLC Bridge Gateway on port 18800..."
node gateway.js
