#!/usr/bin/perl

# default JSON::XS module tends to treat numbers as strings
# export PERL_JSON_BACKEND=JSON::PP

use strict;
use JSON;
use Data::Dumper;

opendir my $DIR, $ARGV[0];
my @Files = map {$ARGV[0]."/".$_} readdir $DIR;
closedir $DIR;

my $data = {};
foreach my $file (grep {-f $_} @Files){
	# File format appears to be ~64 bytes header then null pad up to byte 4096
	# followed by an arbitrary series of blocks where the first 4 bytes are
	# the length of the block-4** and then actual block data
	# **blocks are padded to be multiples of 4 bytes
	# Check that byte 3 is 0x49 ("I") and byte 37 is \x31 ("1")
	# This seems to indicate the file has JSON data where the first block is a
	# description and the second block is the actual JSON data
	open my $IN, $file;
	binmode $IN;
	my $buffer;
	seek $IN, 3, 0;
	read $IN, $buffer, 1;
	if( $buffer eq "\x49" ){
		seek $IN, 37, 0;
		read $IN, $buffer, 1;
		if( $buffer eq "\x31" ){
			seek $IN, 4096, 0;
			read $IN, $buffer, 4;
			my $len = unpack "L", $buffer; # length of description
			read $IN, my $desc, $len;
			if( $len % 4 ){
				seek $IN, 4-($len%4), 1; # skip to start of next 4-byte block
			}
			read $IN, $buffer, 4;
			$len = unpack "L", $buffer; # length of JSON data
			if( $len ){
				read $IN, my $json, $len;
				$data->{$desc} = eval{ decode_json($json) };
				die "ERROR: Invalid JSON data ($file)" if $@;
				$data->{$desc}{file} = $file;
			}
		}
	}
}

# delete garbage level
delete $data->{level00};

# Level descriptions are in the form "levelN" where N is the level number 
foreach my $desc (grep {/^level\d+$/} keys %{$data}){
	# read board layout
	my (@tiles);
	my ($minX,$maxX,$minY,$maxY) = (0xff,-1,0xff,-1);
	foreach my $tile (@{$data->{$desc}{rangeElements}},@{$data->{$desc}{goals}}){
		# determine tile boundaries for generating level fingerprint
		$minX = $tile->{position}{x} if $tile->{position}{x} < $minX;
		$maxX = $tile->{position}{x} if $tile->{position}{x} > $maxX;
		$minY = $tile->{position}{y} if $tile->{position}{y} < $minY;
		$maxY = $tile->{position}{y} if $tile->{position}{y} > $maxY;
		push @tiles, {
			x => $tile->{position}{x},
			y => $tile->{position}{y},
			range => $tile->{range} || -1
		};
	}
	$data->{$desc} = {
		file => (split(/\//,$data->{$desc}{file}))[-1],
		fp => join( ":", $maxX-$minX+1, $maxY-$minY+1, map {($_->{x}-$minX,$_->{y}-$minY,$_->{range})} sort {$a->{x}<=>$b->{x}||$a->{y}<=>$b->{y}} @tiles),
		cols => $data->{$desc}{columns},
		rows => $data->{$desc}{rows},
		tiles => \@tiles
	};
}

# Solution descriptions are in the form "levelNSolution" where N is the level number 
foreach my $desc (grep {/^level\d+Solution$/} keys %{$data}){
	# read solution moves (these are the hints)
	my @solution;
	foreach my $move (@{$data->{$desc}{solution}}){
		push @solution, {
			x  => $move->{rangeElements}{position}{x},
			y  => $move->{rangeElements}{position}{y},
			dx => $move->{direction}{x},
			dy => $move->{direction}{y}
		}
	}
	$data->{substr($desc,0,-8)}{solution} = \@solution;
}
# Load extra solutions
if( -e "solutions.json" ){
	my $solutions = eval{ decode_json(do{undef $/;open my $IN, "solutions.json";<$IN>}) };
	die "ERROR: Invalid JSON data (solutions.json)" if $@;
	foreach my $levelId (keys %{$solutions}){
		if( exists $data->{$levelId} ){
			$data->{$levelId}{solution} = $solutions->{$levelId};
		}
	}
}

my (@Levels,@Packs,%FingerPrints);
my $lastLevel = 0;
# Level pack descriptions are in the form "level_packs_N" where N is the pack number
foreach my $desc (sort {$data->{$a}{packId}<=>$data->{$b}{packId}} grep {/^level_packs_\d+$/} keys %{$data}){
	my $numLevels = 0;
	# Add levels to @Levels based on pack order
	foreach my $level (@{$data->{$desc}{levels}}){
		if( exists $data->{$level} ){
			$data->{$level}{packId} = $data->{$desc}{packId}; # add packId property to the level
			push @Levels, $data->{$level};
			$FingerPrints{$data->{$level}{fp}} = sprintf "%s (%s)", $level, $data->{$level}{file}; # add fingerprint for duplicate level detection
			$numLevels++;
			delete $data->{$level};
		}
	}
	if( $numLevels ){
		$Packs[$data->{$desc}{packId}] = {
			packId => $data->{$desc}{packId},
			c1 => $data->{$desc}{colorPrimaryPack},
			c2 => $data->{$desc}{colorSecundaryPack},
			firstLevel => $lastLevel+1,
			lastLevel => $lastLevel+$numLevels
		};
		$lastLevel += $numLevels;
	}
}

# Add extra levels and an extra level pack
my @extraLevels = sort {substr($a,5)<=>substr($b,5)} grep {/^level\d+$/ && !exists $FingerPrints{$data->{$_}{fp}}} keys %{$data};
if( scalar(@extraLevels) ){
	push @Levels, map {$data->{$_}{packId}=scalar(@Packs);$data->{$_}} @extraLevels;
	push @Packs, {
		packId => $Packs[-1]{packId}+1,
		c1 => $Packs[-1]{c1},
		c2 => $Packs[-1]{c2},
		firstLevel => $lastLevel+1,
		lastLevel => $lastLevel+scalar(@extraLevels)
	};
}
# Report duplicate levels
my @duplicateLevels = sort {substr($a,5)<=>substr($b,5)} grep {/^level\d+$/ && exists $FingerPrints{$data->{$_}{fp}}} keys %{$data};
foreach my $level (@duplicateLevels){
	printf STDERR "ERROR: Duplicate Level - %s (%s) is identical to %s\n", $level, $data->{$level}{file}, $FingerPrints{$data->{$level}{fp}};
}

# Remove unnecessary properties
map {delete @{$_}{qw/file fp levelId/}} @Levels;

print to_json({packs=>\@Packs,levels=>\@Levels},{canonical=>1});
exit;
