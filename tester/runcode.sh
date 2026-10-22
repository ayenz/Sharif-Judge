#!/bin/bash

# This file runs a command with given limits
# usage: ./runcode.sh extension memorylimit timelimit timelimit_int input_file command

EXT=$1
shift

MEMLIMIT=$1
shift

TIMELIMIT=$1
shift

TIMELIMITINT=$1
shift

IN=$1
shift

# The Command:
CMD=$@

# detecting existence of timeout
TIMEOUT_EXISTS=true
hash timeout 2>/dev/null || TIMEOUT_EXISTS=false


if [ $EXT == "py2" ]; then
        mem=$(pid=$(python2 >/dev/null 2>/dev/null & echo $!) && ps -p $pid -o vsz=; kill $pid >/dev/null 2>/dev/null;)
        MEMLIMIT=$((MEMLIMIT+mem+5000))
elif [ $EXT == "py3" ]; then
        mem=$(pid=$(python3 >/dev/null 2>/dev/null & echo $!) && ps -p $pid -o vsz=; kill $pid >/dev/null 2>/dev/null;)
        MEMLIMIT=$((MEMLIMIT+mem+5000))
fi


# Imposing memory limit with ulimit
# Java (also zips of sources and JARs), Node.js and Go reserve far more address space than they use, so they cannot run
# under a virtual-memory limit; their memory is limited by the runtime and ./timeout --rss.
if [ "$EXT" != "java" ] && [ "$EXT" != "jzip" ] && [ "$EXT" != "jar" ] && [ "$EXT" != "js" ] && [ "$EXT" != "go" ]; then
	ulimit -v $((MEMLIMIT+10000))
	ulimit -m $((MEMLIMIT+10000))
	ulimit -s $((MEMLIMIT+10000))
fi

# Imposing time limit with ulimit
ulimit -t $TIMELIMITINT

# JavaScript and Go: record the exact peak resident memory (checked by tester.sh). GNU time runs
# outside SHJ_RUNAS, so the file is written by the judge, not by the submitted program.
PEAK=""
if [ "$EXT" = "js" ] || [ "$EXT" = "go" ]; then
	if [ -n "$SHJ_PEAK_FILE" ] && [ -x /usr/bin/time ]; then
		PEAK="/usr/bin/time -q -f %M -o $SHJ_PEAK_FILE"
	fi
fi

if $TIMEOUT_EXISTS; then
	# Run the command with REAL time limit of TIMELIMITINT*2
	timeout -s9 $((TIMELIMITINT*2)) $PEAK $SHJ_RUNAS $CMD <$IN >out 2>err
else
	# Run the command
	$PEAK $SHJ_RUNAS $CMD <$IN >out 2>err	
fi
# You can run submitted codes as another user:
#
# if $TIMEOUT_EXISTS; then
# 	sudo -u another_user timeout -s9 $((TIMELIMITINT*2)) $CMD <$IN >out 2>err
# else
# 	sudo -u another_user $CMD <$IN >out 2>err	
# fi
#
# But you should change your sudoers file and allow the user running PHP (e.g. www-data in Ubuntu+Apache) to su to another_user
# e.g. In Ubuntu (Apache running under www-data), run visudo and add this line:
# www-data ALL=(another_user) NOPASSWD: ALL
EC=$?

# KILL all processes of another_user (A process may still be alive!)
# If you are running codes as another_user, also uncomment this line:
#sudo -u another_user pkill -9 -u another_user

# Return exitcode
exit $EC
