#!/usr/bin/perl

use strict;
use JSON;

chdir $ARGV[0];
opendir my $DIR, ".";
my @Files = sort readdir $DIR;
closedir $DIR;

my $dehz = {};

foreach my $f (grep {-f $_} @Files){
	my $data = do{local $/;open my $IN, $f;binmode $IN;<$IN>} =~ /(level[\w\W]*)/ ? $1 : "";
	if( $data =~ /^level_(?<type>pack)s_(?<id>\d+)\0*....(?<data>\{[\w\W]*\})/ || $data =~ /^level(?<id>\d+)(?<type>Solution)\0*....(?<data>\{[\w\W]*\})/ || $data =~ /^(?<type>level)(?<id>\d+)\0*....(?<data>\{[\w\W]*\})/ ){
		$dehz->{lc $+{type}}{$+{id}} = from_json($+{data});
	}
	else{
		$data = substr($data,0,100);
		$data =~ s/([\x00-\x1f\x7f-\xff])/?/g;
		print STDERR "$f\t$data\n";
	}
}

delete $dehz->{level}{"00"};
foreach my $l (keys %{$dehz->{level}}){
	my $s = $dehz->{solution}{$l}{solution};
	$l = $dehz->{level}{$l};
	$l->{cols} = $l->{columns};
	foreach my $t (@{$l->{goals}},@{$l->{rangeElements}}){
		push @{$l->{tiles}}, {x=>$t->{position}{x},y=>$t->{position}{y},range=>$t->{range}||-1};
	}
	delete @{$l}{qw/columns goals rangeElements/};
	if( $s ){
		foreach my $m (@$s){
			$m = {
				x =>  $m->{rangeElements}{position}{x},
				y =>  $m->{rangeElements}{position}{y},
				dx => $m->{direction}{x},
				dy => $m->{direction}{y}
			};
		}
		$l->{solution} = $s;
	}
}

my ($levelOffset,@packs,@levels);
foreach my $p (sort {$a<=>$b} keys %{$dehz->{pack}}){
	$p = $dehz->{pack}{$p};
	$p->{firstLevel} = $levelOffset+1;
	foreach my $l (@{$p->{levels}}){
		$l =~ s/level//;
		if( exists $dehz->{level}{$l} ){
			$dehz->{level}{$l}{packId} = $p->{packId};
			push @levels, delete $dehz->{level}{$l};
			$levelOffset++;
		}
	}
	if( $levelOffset >= $p->{firstLevel} ){
		$p->{c1} = $p->{colorPrimaryPack};
		$p->{c2} = $p->{colorSecundaryPack};
		$p->{lastLevel} = $levelOffset;
		delete @{$p}{qw/colorPrimaryPack colorSecundaryPack levels/};
		push @packs, $p;
	}
}

my $p = {
	firstLevel=>$levelOffset+1,
	packId=>scalar(@packs)
};
foreach my $l (keys %{$dehz->{level}}){
	$l = $dehz->{level}{$l};
	$l->{packId} = $p->{packId};
	push @levels, $l;
	$levelOffset++;
}
if( $levelOffset >= $p->{firstLevel} ){
	$p->{c1} = $packs[0]->{c2};
	$p->{c2} = $packs[0]->{c1};
	$p->{lastLevel} = $levelOffset;
	push @packs, $p;
}

print to_json({packs=>\@packs,levels=>\@levels},{canonical=>1});
