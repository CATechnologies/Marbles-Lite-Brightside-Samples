#!/bin/sh

memlist=($(bright files list all-members solsu01.mimpds.cntl | grep -v "GDI"))
memlist=${memlist[@]//$GDI*}
printf '%s\n' "${memlist[@]}"
