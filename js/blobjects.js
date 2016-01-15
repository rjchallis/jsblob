// blobjects.js globals and objects for interactive blob plots



function Blobplot (data){
	this.blobs = data.dict_of_blobs;
	
	this.ranks = {"k":"f","f":"o","o":"p"};
	this.rank = "k";
	
	this.taxrules = {"bestsum":1};
	this.taxrule = "bestsum";
	
	this.covs = {"cov0":1,"cov1":2,"cov2":3,"cov3":2};
	this.cov = "cov0";
	
	this.maxgroups = 7;
	this.collection = {}; // bin taxa, e.g. all bacteria at family level
	
	this.palette = d3.scale.category10();
	
	var margin = {top: 20, right: 20, bottom: 40, left: 40},
        width = 960 - margin.left - margin.right,
        height = 960 - margin.top - margin.bottom;

	this.margin = margin;
	this.width = width;
	this.height = height;

	this.radius = d3.scale.log()
	    .domain([1, 4000])
	    .range([0.1, 15]);
	
	this.hexbin = d3.hexbin()
	    .size([10, 10])
	    .radius(0.1429);
	
	this.x = d3.scale.linear()
	    .domain([0, 10])
	    .range([0, width]);
	
	this.y = d3.scale.linear()
	    .domain([-4, 6])
	    .range([height, 0]);
	
	this.xax = d3.scale.linear()
	    .domain([0, 1])
	    .range([0, width]);
	
	this.yax = d3.scale.log()
	    .domain([0.0001, 1000000])
	    .range([height, 0]);
	
	this.xAxis = d3.svg.axis()
	    .scale(this.xax)
	    .orient("bottom")
	    .tickSize(6, -height);
	
	this.yAxis = d3.svg.axis()
	    .scale(this.yax)
	    .orient("left")
	    .tickSize(6, -width);

}


Blobplot.prototype.Rank = function(rank){
	if (!rank) return this.rank
	if (!this.ranks[rank]) return this.rank
	this.rank = rank
	return rank;
}

Blobplot.prototype.Taxrule = function(taxrule){
	if (!taxrule) return this.taxrule
	if (!this.taxrules[taxrule]) return this.taxrule
	this.taxrule = taxrule
	return taxrule;
}

Blobplot.prototype.Cov = function(cov){
	if (!cov) return this.cov
	if (!this.covs[cov]) return this.cov
	this.cov = cov
	return cov;
}

Blobplot.prototype.Maxgroups = function(n){
	if (!n) return this.maxgroups
	this.maxgroups = n
	return n;
}

Blobplot.prototype.Collection = function(rank,taxa,filter){
	if (!rank) return this.collection;
	if (!taxa) return this.collection[rank];
	var collection = {};
	collection.taxa = taxa;
	collection.filter = filter == 'include' ? 'include' : 'exclude';
	this.collection[rank] = collection;
	return collection;
}


function clone(obj) {
	var newobj = {}
    for(var key in obj){
    	if( obj.hasOwnProperty( key ) ) {
    		newobj[key] = obj[key];
    	}
    }
    return newobj;
}


function getSortedKeys(obj) {
    var keys = []; 
    for(var key in obj){
    	if( obj.hasOwnProperty( key ) ) {
    		keys.push(key);
    	}
    }
    return keys.sort(function(a,b){return obj[b].length-obj[a].length});
}

function removeItems(arr,items) {
	items.forEach(function(item,i){
		var index = arr.indexOf(item);
		if (index >= 0) {
			arr.splice( index, 1 );
		}
	});
    return arr;
}

Blobplot.prototype.applyRules = function(){
	var points = {};
	var ctr = 0;
	
	// select taxrule, rank and coverage
	for( var contig in this.blobs ) {
    	if( this.blobs.hasOwnProperty( contig ) ) {
    		if (!points[this.blobs[contig].taxonomy[this.taxrule][this.rank].t]){
    			points[this.blobs[contig].taxonomy[this.taxrule][this.rank].t] = [];
    		}
    		points[this.blobs[contig].taxonomy[this.taxrule][this.rank].t].push([this.blobs[contig].gc*10,Math.log10(this.blobs[contig].covs[this.cov] + 0.001),contig,this.blobs[contig].len]);
    		ctr++;
    	}
	}
	this.points = points;
	this.taxorder = getSortedKeys(points);
	return ctr;
}

Blobplot.prototype.filterTaxa = function(){
	var taxa = this.collection[this.rank].taxa;
	var filter = this.collection[this.rank].filter;
	var points = {};
	var order = this.taxorder.slice(0);
	if (filter == 'exclude'){
		points = clone(this.points);
		taxa.forEach(function(taxon,i){
			delete points[taxon]
		});
		order = removeItems(order,taxa);
	}
	else { // include taxa in filter
		var origpoints = this.points;
		taxa.forEach(function(taxon,i){
			if (origpoints[taxon]){
				points[taxon] = origpoints[taxon]
			}
		});
		order = taxa;
	}
	this.filteredPoints = points;
	this.filteredOrder = order;
	
	/* relocate this code
	// limit number of unique taxon names to display
	if (Object.keys(points).length > this.maxgroups){
		var sorted = getSortedKeys(points);
		var sortedpoints = {};
		var taxorder = [];
		var maxgroups = this.maxgroups;
		sorted.forEach(function(taxon,i){
			if (i + 1 < maxgroups){
				sortedpoints[taxon] = points[taxon];
				taxorder.push(taxon)
			}
			else if (i + 1 == maxgroups){
				sortedpoints['other'] = points[taxon];
				taxorder.push('other')
				
			}
			else {
				sortedpoints['other'].concat(points[taxon]);
			}
		});
		this.displaypoints = sortedpoints;
		this.taxorder = taxorder;
	}*/
}

Blobplot.prototype.unFilterTaxa = function(){
	this.filteredPoints = null;
	return 1;
}

Blobplot.prototype.assignColors = function(){
	// assign colours automatically (add option to chose colours for taxa)
	var colormap = {};
	var maxgroups = this.maxgroups;
	var palette = this.palette;
	var count = this.filteredOrder.length;
	this.filteredOrder.forEach(function(taxon,i){
		if (i + 1 < maxgroups || count <= maxgroups){
			colormap[taxon] = palette(i);
		}
		else {
			colormap[taxon] = 'white';
		}
	});
	this.colormap = colormap;
}

var blob;

d3.json("json/blob.BlobDB.smaller.json", function(error, json) {
	if (error) return console.warn(error);
	blob = new Blobplot(json);
	n_contigs = blob.applyRules();
	console.log(n_contigs);
	blob.Collection(blob.Rank(),['-'],'exclude')
	if (blob.Collection(blob.Rank())){
		// filter taxa to display
		blob.filterTaxa();
	}
	// set colours
	blob.assignColors();
	
	// bin contigs
	
	// plot blobs
	
});




