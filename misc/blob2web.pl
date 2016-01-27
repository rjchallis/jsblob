#!/usr/bin/perl -w

use strict;

use JSON::XS;

$| = 1;

my $json_text = '';
while (<>){
	$json_text .= $_;
}
my $ref = decode_json $json_text;

#foreach my $key (keys %{$ref}){
#	print $key," ";
#	if (ref($ref->{$key})){
#		if (ref($ref->{$key}) eq 'ARRAY'){
#			print 'ARRAY ',scalar @{$ref->{$key}};
#		}
#		else {
#			print 'HASH ',keys(%{$ref->{$key}});
#		}
#	}
#	else {
#		print 'SCALAR ',$ref->{$key};
#	}
#	print "\n";
#}

my $hash;

my %indices;

$indices{'ranks'} = {"superkingdom" => 0,
					 "phylum"		=> 1,
					 "order"		=> 2,
					 "family"		=> 3,
					 "genus"		=> 4,
					 "species"		=> 5};
					 
$indices{'covLibs'} = {"cov0" 		=> 0,
					   "cov1"		=> 1,
					   "cov2"		=> 2,
					   "cov3"		=> 3};
					   
$indices{'taxrules'} = {"bestsum" 	=> 0};



#foreach my $lineage (keys %{$ref->{lineages}}){
#	for (my $i = 1; $i < scalar @order; $i++){
#		if (!$ref->{lineages}->{$lineage}->{$order[$i]} || $ref->{lineages}->{$lineage}->{$order[$i]} =~ m/-undef$/){
#			$name2id{$ref->{lineages}->{$lineage}->{$order[($i-1)]}} = $lineage;
#			print $order[$i],"\n";
#			print $ref->{lineages}->{$lineage}->{$order[$i]}," ",$lineage,"\n";
#			last;
#		}
#	}
#}

#print $name2id{"Bacteria"},"\n";

my %ranks;
my %ranknames;
my $prev;
foreach my $rank (sort { $indices{'ranks'}{$a} <=> $indices{'ranks'}{$b} } keys %{$indices{'ranks'}}){
	$ranknames{$indices{'ranks'}{$rank}} = $rank;
	if ($prev){
		$ranks{$indices{'ranks'}{$prev}} = $indices{'ranks'}{$rank};
	}
	$prev = $rank;
}
$hash->{ranks} = \%ranks;
$hash->{ranknames} = \%ranknames;

my @covs;
foreach my $cov (sort { $indices{'covLibs'}{$a} <=> $indices{'covLibs'}{$b} } keys %{$indices{'covLibs'}}){
	push @covs, $cov;
}
$hash->{covs} = \@covs;

my @taxrules;
foreach my $taxrule (sort { $indices{'taxrules'}{$a} <=> $indices{'taxrules'}{$b} } keys %{$indices{'taxrules'}}){
	push @taxrules, $taxrule;
}
$hash->{taxrules} = \@taxrules;


our %taxindex;

foreach my $rank (sort { $indices{'ranks'}{$a} <=> $indices{'ranks'}{$b} } keys %{$indices{'ranks'}}){
	my $ctr = 0;
	foreach my $contig (keys %{$ref->{dict_of_blobs}}){
		$hash->{dict_of_blobs}->{$contig}->{l} = $ref->{dict_of_blobs}->{$contig}->{'length'};
		$hash->{dict_of_blobs}->{$contig}->{gc} = $ref->{dict_of_blobs}->{$contig}->{gc};
		$hash->{dict_of_blobs}->{$contig}->{n} = $ref->{dict_of_blobs}->{$contig}->{n_count} if $ref->{dict_of_blobs}->{$contig}->{n_count};
		$hash->{dict_of_blobs}->{$contig}->{cov} = [];
		foreach my $cov (keys %{$ref->{dict_of_blobs}->{$contig}->{covs}}){
			$hash->{dict_of_blobs}->{$contig}->{cov}->[$indices{'covLibs'}->{$cov}] = $ref->{dict_of_blobs}->{$contig}->{covs}->{$cov};
		}
		$hash->{dict_of_blobs}->{$contig}->{tax} = [];
		foreach my $taxonomy (keys %{$ref->{dict_of_blobs}->{$contig}->{taxonomy}}){
			my @tax = $hash->{dict_of_blobs}->{$contig}->{taxonomy}->[$indices{'taxrules'}->{$taxonomy}] ? @{$hash->{dict_of_blobs}->{$contig}->{taxonomy}->[$indices{'taxrules'}->{$taxonomy}]} : ();
			my $tax = $ref->{dict_of_blobs}->{$contig}->{taxonomy}->{$taxonomy}->{$rank}->{tax};
			$tax[$indices{'ranks'}->{$rank}] = { 's' => $ref->{dict_of_blobs}->{$contig}->{taxonomy}->{$taxonomy}->{$rank}->{score},
												 't' => tax_index($tax)
											   };
			$tax[$indices{'ranks'}->{$rank}]->{'c'}	= $ref->{dict_of_blobs}->{$contig}->{taxonomy}->{$taxonomy}->{$rank}->{c_index} if $ref->{dict_of_blobs}->{$contig}->{taxonomy}->{$taxonomy}->{$rank}->{c_index};
			$hash->{dict_of_blobs}->{$contig}->{taxonomy}->[$indices{'taxrules'}->{$taxonomy}] = \@tax;
		}
		$ctr++;
		#last if $ctr == 100000;
	}
}

my %revindex;
foreach my $taxon (keys %taxindex){
	$revindex{$taxindex{$taxon}} = $taxon;
}
$hash->{taxindex} = \%revindex;

my $json_out = encode_json $hash;

print $json_out,"\n";


sub tax_index {
	my $tax = shift;
	return $taxindex{$tax} if $taxindex{$tax};
	$taxindex{$tax} = scalar(keys(%taxindex)) + 1;
	return $taxindex{$tax};
}

__END__

new blobdb format:

covLibs:[
	{	n:cov0,
		...
	},
	...	
]

ranks:[
	"superkingdom",
	"phylum",
	"order",
	"family",
	"genus",
	"species"
]

taxrules:[
	bestsum,
	...	
]

dict_of_blobs:{
	contig_1:{	l:200,
				gc:0.54,
				n:12,
				cov:[0,12,36.5,1000]
				tax:[	[	{	s:4000,
								t:123456,
								c:1
							},
							{	s:5000,
								t:1234567,
								c:1
							}
						],
						[	{	s:300,
								t:234567,
								c:0
							},
							...
						]
				]			
	},
	...
}