#!/bin/sh

memlist=($(bright files list all-members solsu01.mimpds.cntl | grep -v "GDI"))
printf '%s\n' "${memlist[@]}"
