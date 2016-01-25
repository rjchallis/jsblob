// blobjects.js globals and objects for interactive blob plots

var dispatch = d3.dispatch("load", "toggletaxa", "resizebins", "changescale", "changerscale", "resizehexes", "filterpreviewstart", "filterpreviewend", "select", "blobselect", "mapselect", "mapzoom", "rankchange", "filter");

function Blobplot (data,options){
	this.blobs = data.dict_of_blobs;
	
	options = options || {};
	
	var width = options.width || 900,
		height = options.height || 900;
	
	var default_options = {
        maxgroups:   7,
        rank:        'k',
        ranks:       {"k":"p","p":"o","o":"f"},
        ranknames:   {	"k":"superkingdom",
						"p":"phylum",
						"o":"order",
						"f":"family"
					},
		taxrules:   {"bestsum":1},
		taxrule:    "bestsum",
		covs:       {"cov0":1,"cov1":2,"cov2":3,"cov3":2},
		cov:        "cov0",
		zerocov:    0.001,
		collection: {},
		palette:    d3.scale.category10(),
		
		blobdiv:    'blob-plot',
		menudiv:    'menu',
		treediv:    'treemap-plot',
		
		
		margin:     {top: 20, right: 20, bottom: 40, left: 40},
        width:      width,
        height:     height,
        
        binscale:	4,
        hexsize:	1,
	    radius:		d3.scale.sqrt()
	    				.domain([1, 3313])
	    				.range([2, 14]),
	    rscalename:	'sqrt',
	    hexbin:		d3.hexbin()
	    				.size([10, 10])
	    				.radius(0.16),
	    x:			d3.scale.linear()
	    				.domain([0, 10])
	    				.range([0, width]),
	    y:			d3.scale.linear()
	    				.domain([-4, 6])
	    				.range([height, 0]),
	    xax:		d3.scale.linear()
	    				.domain([0, 1])
	    				.range([0, width]),
	    yax:		d3.scale.log()
	    				.domain([0.0001, 1000000])
	    				.range([height, 0]),
	    				
	    treevalue:	function(d) { return d.count; },
	    blobvalue:	function(d)	{ return d.length; }
    };

    options = options || {};
    Object.keys(default_options).forEach(function(opt){
        if (!options.hasOwnProperty(opt)){
        	options[opt] = default_options[opt];
        }
    });
	
	this.ranknames = options.ranknames;
	this.ranks = options.ranks;
	this.rank = options.rank;
	
	this.taxrules = options.taxrules;
	this.taxrule = options.taxrule;
	
	this.covs = options.covs;
	this.cov = options.cov;
	this.zerocov = options.zerocov;
	
	this.maxgroups = options.maxgroups;
	this.collection = options.collection; // bin taxa, e.g. all bacteria at family level
	
	this.palette = options.palette;
	
	this.blobdiv = options.blobdiv;
	this.menudiv = options.menudiv;
	this.treediv = options.treediv;
	
	this.margin = options.margin;
	this.width = options.width;
	this.height = options.height;

	this.radius = options.radius;
	this.rscalename = options.rscalename;
	this.hexbin = options.hexbin;
	this.binscale = options.binscale;
	this.hexsize = options.hexsize;
	
	this.x = options.x;
	this.y = options.y;
	
	this.xax = options.xax;
	this.yax = options.yax;
	
	this.xAxis = d3.svg.axis()
	    .scale(this.xax)
	    .orient("bottom")
	    .tickSize(6, -options.height);
	this.yAxis = d3.svg.axis()
	    .scale(this.yax)
	    .orient("left")
	    .tickSize(6, -options.width);
	
	this.contigFilters = {};
	
	this.dragging = false;
	this.cells = {};
	
	this.treevalue = options.treevalue;
	this.blobvalue = options.blobvalue;
}


Blobplot.prototype.setupMenus = function(){
	var treediv = d3.select("#menus")
    .style("position", "absolute")
    .style("width", this.width + "px")
    .style("height", this.height + "px")
    .style("left", this.margin.left + "px")
    .style("top", this.margin.top + "px");

	blob.showFilters('filters');
	blob.ranksDropdown('ranks');
	blob.binSizer();
}

Blobplot.prototype.binSizer = function(){
	var slider = d3.select('#bin-size-slider');
	var blobplot = this;
	slider.on('change',function(){ dispatch.resizebins(blobplot,d3.select(this).property('value'));});
}

Blobplot.prototype.setupPlot = function(){
	d3.select('#'+this.blobdiv).select('svg').remove();
	var svg = d3.select('#'+this.blobdiv).append("svg")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom)
        .attr("id",this.blobdiv+"_svg");
    var blobplot = this;
    svg.on("mouseup",function(){
	    	blobplot.dragging = false;
	    });
	    
    var plotarea = svg.append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

	plotarea.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("class", "mesh")
        .attr("width", this.width)
        .attr("height", this.height);

	plotarea.append("g")
        .attr("class", "y axis")
        .call(this.yAxis);

    plotarea.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);
    
    var hexgroup = plotarea.append("g");
	var overgroup = plotarea.append("g").attr("clip-path", "url(#clip)");
	var previewgroup = plotarea.append("g").attr("id", "preview").attr("clip-path", "url(#clip)");

    this.plotarea = plotarea;
	this.hexgroup = hexgroup;
	this.overgroup = overgroup;

}




Blobplot.prototype.Points = function(){
	if (!this.points){
		this.displayPoints = null;
		this.filteredPoints = null;
		this.taxorder = null;
		this._applyRules();
	}
	if (this.displayPoints){
		return this.displayPoints;
	}
	if (this.filteredPoints){
		return this.filteredPoints;
	}
	else if (blob.Collection(blob.Rank())){
		blob._filterTaxa();
		return this.filteredPoints;
	}
	return this.points;
}

Blobplot.prototype.Taxorder = function(){
	if (!this.taxorder){
		this.filteredOrder = null;
		this.colormap = null;
		this._limitTaxa();
	}
	if (this.filteredOrder){
		return this.filteredOrder;
	}
	return this.taxorder;
}



Blobplot.prototype.Rank = function(rank){
	if (!rank) return this.rank
	if (!this.ranks[rank]) return this.rank
	this.rank = rank
	var blob = this;
	dispatch.rankchange(blob);
	
	
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

Blobplot.prototype.Blobs = function(){
	if (!this.filteredblobs){
		blob._filterContigs();
	}
	return this.filteredblobs;
}

Blobplot.prototype.ColorMap = function(option){
	if (!this.colormap || option == 'new'){
		this._assignColors();
	}
	return this.colormap;
}

Blobplot.prototype.Hexed = function(taxon){
	if (!this.hexed){
		this._limitTaxa();
		this._binContigs();
	}
	if (taxon){
		if (taxon == 'all'){
			return this.hexall;
		}
		return this.hexed[taxon];
	}
	return this.hexed;
}

Blobplot.prototype.plotBlobs = function(target){

	var hexg = this.hexgroup;
	var overg = this.overgroup;
	var hexed = this.Hexed();
	var hexall = this.Hexed('all');
	var radius = this.radius;
	var colormap = this.ColorMap();
	var hexbin = this.hexbin;
	var x = this.x;
	var y = this.y;
	
	var blobplot = this;
	
	var data = [];
	this.Taxorder().forEach(function(taxon){
		data.push({key:taxon,values:blobplot.Hexed(taxon)});
	});
	
	var bins = {};
	
	var groups = hexg.selectAll('g').data(data);
	groups.enter().append('g');
	var hexagons = groups.attr("clip-path", "url(#clip)")
	    	.attr("class", function(d){ var css = d.key; if (blobplot.taxa && blobplot.taxa[d.key] && !blobplot.taxa[d.key].visible){ css += ' hidden'} return css;} )
	  		.selectAll(".hexagon").data(function(d){var tax = d.key;
	  												var arr = d3.values(d.values);
	  													arr.forEach(function(value){
	  														value.key = tax;
	  													});
	  												return arr;
	  								});
		hexagons.enter().append("path");
		hexagons.attr("class", "hexagon")
	    		.style("fill", function(d){ return colormap[d.key]})
	    		//.style("opacity", function(d) { return Math.log10(radius(d.length))/Math.log10(radius(blob.Maxbin())); })
	    		.attr("rel", function(d) { bins[d.id] = bins[d.id] ? bins[d.id] + 1 : 1; return d.id; })
	    		.attr("d", function(d) {  return hexbin.hexagon(radius(blob.blobvalue(d))); })
	    		.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
		hexagons.exit().remove();
	groups.exit().remove();
	
	var overlay = overg.attr("clip-path", "url(#clip)").selectAll(".overlay").data(d3.values(hexall))
	overlay.enter().append("path")
	overlay.attr("id", function(d){ return "cell_"+d.id })
	    .attr("class", function(d){ return "overlay c"+d.id })
	    .attr("rel", function(d) { return d.id; })
	    .style("stroke",function(d){return 'rgba(0,0,0,'+(0.1+bins[d.id]/20)+')'})
	    .classed("hidden",function(d){if (!bins[d.id]) {return true}})
	    .attr("d", function(d) { return hexbin.hexagon(radius(blob.Maxbin())/blob.hexsize); })
	    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
	    .on("mousedown",function(){
	    	if (d3.select(this).classed("selected")){
				blobplot.dragging = 'off';
			}
			else {
				if (!d3.event.shiftKey) {
        			blobplot.selectNone(1);
    			}
				blobplot.dragging = 'on';
			}
	    	blobplot.toggleCell(this);
	    })
	    .on("mouseover",function(){
	    	if (blobplot.dragging){
	    		blobplot.toggleCell(this);
	    	}
	    })
	    .on("mouseup",function(){
	    	blobplot.dragging = false;
	    })
	overlay.exit().remove();
}

Blobplot.prototype.previewBlobs = function(underblob){

	var blobplot = this;
	underblob = underblob || blobplot;
	
	var prevg = d3.select('#preview');
	var hexall = this.Hexed('all');
	var radius = underblob.radius;
	var hexbin = underblob.hexbin;
	var x = underblob.x;
	var y = underblob.y;
	
	
	var preview = prevg.selectAll(".preview").data(d3.values(hexall))
	preview.enter().append("path")
	preview.attr("class", function(d){ return "preview c"+d.id })
	    .attr("d", function(d) { return hexbin.hexagon(radius(underblob.Maxbin())/underblob.hexsize); })
	    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
	preview.exit().remove();
}

Blobplot.prototype.endPreview = function(target){

	var prevg = d3.select('#preview');
	prevg.selectAll(".preview").classed('hidden',true)
}

Blobplot.prototype._filterContigs = function(){
	this.filteredblobs = clone(this.blobs);
	for( var filter in this.contigFilters ) {
    	if( this.contigFilters.hasOwnProperty( filter ) ) {
    		if (this.contigFilters[filter].active){
    			this._applyContigFilter(filter);
    		}
    	}
    }
}

Blobplot.prototype._inverseFilterContigs = function(){
	filteredblobs = {};
	var blobs = clone(this.blobs);
	for( var filter in this.contigFilters ) {
    	if( this.contigFilters.hasOwnProperty( filter ) ) {
    		this.contigFilters[filter].contigs.forEach(function(contig,i){
				filteredblobs[contig] = blobs[contig];
			});
    	}
    }
    this.filteredblobs = filteredblobs;
}


Blobplot.prototype._applyContigFilter = function(name){
	var filteredblobs = this.filteredblobs;
	this.contigFilters[name].contigs.forEach(function(contig,i){
		delete filteredblobs[contig];
	});
}

Blobplot.prototype._applyRules = function(){
	var points = {};
	var ctr = 0;
	var blobs = this.Blobs();
	var taxrule = this.taxrule;
	var cov = this.cov;
	var rank = this.rank;
	var zerocov = this.zerocov;
	
	// select taxrule, rank and coverage
	Object.keys(blobs).forEach(function(contig){
		var taxon = blobs[contig].taxonomy[taxrule][rank].t;
		if (!points[taxon]){
    		points[taxon] = [];
    	}
    	points[taxon].push([blobs[contig].gc*10,Math.log10(blobs[contig].covs[cov] + zerocov),contig,blobs[contig].len]);
	});
	this.points = points;
}

Blobplot.prototype._filterTaxa = function(){
	var taxa = this.collection[this.rank].taxa;
	var filter = this.collection[this.rank].filter;
	var points = {};
	var order = this.taxorder.slice(0);
	if (filter == 'exclude'){
		points = clone(this.Points());
		taxa.forEach(function(taxon,i){
			delete points[taxon]
		});
		order = removeItems(order,taxa);
	}
	else { // include taxa in filter
		var origpoints = this.Points();
		taxa.forEach(function(taxon,i){
			if (origpoints[taxon]){
				points[taxon] = origpoints[taxon]
			}
		});
		order = taxa;
	}
	this.filteredPoints = points;
	this.filteredOrder = order;
}

Blobplot.prototype._limitTaxa = function(){
	// limit number of unique taxon names to display
	var points = this.Points();
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
	this.displayPoints = sortedpoints;
	this.taxorder = taxorder;
}

Blobplot.prototype._assignColors = function(option){
	// assign colours automatically (add option to chose colours for taxa)
	var colormap = {};
	var taxorder = this.Taxorder();
	var maxgroups = this.maxgroups;
	var palette = this.palette;
	var count = taxorder.length;
	taxorder.forEach(function(taxon,i){
		if (i + 1 < maxgroups || count <= maxgroups){
			colormap[taxon] = palette(i);
		}
		else {
			colormap[taxon] = 'white';
		}
	});
	this.colormap = colormap;
	
}

function maxlen(obj){
	var max = 0;
	var maxspan = 0;
	Object.keys(obj).forEach(function(bin){
		if (obj[bin].length > max){
			max = obj[bin].length;
		}
		if (obj[bin].span > maxspan){
			maxspan = obj[bin].span;
		}
	});
	return [max,maxspan];
}

Blobplot.prototype.Maxbin = function(){
	return this.maxbincount;
}

Blobplot.prototype._binContigs = function(){
	var hexed = {};
	var all = [];
	var points = this.Points();
	var hexbin = this.hexbin;
	Object.keys(points).forEach(function(taxon){
    	hexed[taxon] = hexbin(points[taxon])
    	all = all.concat(points[taxon]);
	});
    this.hexed = hexed;
    var hexall = hexbin(all)
	this.hexall = hexall;
	maxes = maxlen(hexall);
	this.maxbincount = maxes[0];
	this.maxbinspan = maxes[1];
	this.radius.domain([1,this.Maxbin()])
	this.radius.range([2,3.6*this.binscale*this.hexsize])
}


Blobplot.prototype.ranksDropdown = function(target){
	var div = d3.select('#'+target);
	div.select('select').remove();
	var select = div.append('select');
	var blobplot = this;
	for( var rank in this.ranks ) {
    	if( this.ranks.hasOwnProperty( rank ) ) {
    		var name = this.ranknames[rank];
    		select.append('option')
    			.attr('value',rank)
    			.property('selected',function(){return rank === blobplot.rank})
    			.text(name);
		}
	}
	select.on('change',function(){ 	blobplot.Rank(this.options[this.selectedIndex].value);
									
	  							})
}

Blobplot.prototype.showTaxa = function(prevtaxa){
	target = 'taxa';
	var blobplot = this;
	var colormap = this.ColorMap();
	prevtaxa = prevtaxa || {};
	var taxa = {};
	this.taxorder.forEach(function(taxon,i){
		taxa[taxon] = {};
		taxa[taxon].visible = (!prevtaxa.hasOwnProperty(taxon) || prevtaxa[taxon].visible == true) ? true : false;
	});
	d3.select('#'+target).selectAll('div').remove();
	var taxdivs = d3.select('#'+target).selectAll('.taxon-options').data(blobplot.taxorder);
	taxdivs.enter().append('div').attr('class','.taxon-options');
	
	//taxa.html('');
	taxdivs.attr('rel',function(d){return d});
	taxdivs.append('div')
		.attr('class','tax-select')
	var checkbox = taxdivs.append('input').attr('type','checkbox')
						.attr('class','taxon-toggle')
						.attr('rel',function(d){ return d; })
						.property('checked',function(d){ if (taxa[d].visible){ return true;} })
						.on('click',function(){
							var checkbox = d3.select(this);
							blobplot.toggleTaxon(checkbox.attr('rel'),checkbox.property('checked'))
							dispatch.toggletaxa(blobplot);
						});
	taxdivs.append('div')
		.attr('class','tax-color')
		.style('background-color',function(d){return colormap[d]});
	taxdivs.append('div')
		.text(function(d){return d});
	
	taxdivs.exit().remove();
	this.taxa = taxa;
	
}




Blobplot.prototype.unFilterTaxa = function(){
	this.filteredPoints = null;
	return 1;
}





function satisfies (relationship,bound,value){
	if (relationship == 'lt'){
		if (value < bound){ return true }
	}
	if (relationship == 'gt'){
		if (value > bound){ return true }
	}
	if (relationship == 'tw'){
		if (value >= bound[0] && value <= bound[1]){ return true }
	}
	if (relationship == 'os'){
		if (value < bound[0] || value > bound[1]){ return true }
	}
	return false;
}


Blobplot.prototype.createContigFilter = function(obj){
	/* {name:"display_name",
	    property:"gc,cov,c_index,len",
	    relationship:"lt, gt, (be)tw(een), o(ut)s(ide)",
	    value:int or array of ints
	   } */
	var filter = obj;
	filter.contigs = [];
	for( var contig in this.blobs ) {
    	if( this.blobs.hasOwnProperty( contig ) ) {
    		var value = this.blobs[contig][obj.property];
    		if (satisfies(obj.relationship,obj.value,value)){
    			filter.contigs.push(contig);
    		}
    	}
    }
    this.contigFilters[obj.name] = filter;
	
}

Blobplot.prototype.createCellFilter = function(name){
	/* {name:"display_name",
	    property:"gc,cov,c_index,len",
	    relationship:"lt, gt, (be)tw(een), o(ut)s(ide)",
	    value:int or array of ints
	   } */
	var filter = {name:name,
	    property:"cells",
	    relationship:"in",
	    value:clone(this.cells)
	   };
	filter.contigs = [];
	var hexed = this.hexed;
	var taxa = this.taxa;
	for( var taxon in hexed ) {
    	if( hexed.hasOwnProperty( taxon ) ) {
    		if (taxa[taxon] && taxa[taxon].visible){
    			for( var cell in filter.value ) {
    				if( filter.value.hasOwnProperty( cell ) ) {
    					if (hexed[taxon][cell]){
    						hexed[taxon][cell].forEach(function(arr,i){
    							filter.contigs.push(arr[2]);
    						});
    					}
    				}
    			}
    		}
    	}
    }
    this.contigFilters[filter.name] = filter;
    this.cells = {};
    d3.selectAll('.selected').classed('selected',false)
    this.showFilters('filters');
}




Blobplot.prototype.toggleCell = function(el){
	var cell = d3.select(el)
	clearTimeout(this.redraw);
	if (cell.classed("selected") && this.dragging == 'off'){
		cell.classed("selected", false);
    	delete this.cells[cell.attr("rel")];
	}
	else if (this.dragging == 'on') {
		cell.classed("selected", true);
		this.cells[cell.attr("rel")] = 1;
    }
    this.delay = this.dragging ? 500 : 0;
    var blobplot = this;
    this.redraw = setTimeout(function(){
    		if (Object.keys(blobplot.cells).length > 0){
				blobplot.generateTreemap();
				blobplot.drawTreemap();
			}
			else {
				d3.select("#treemap-plot").selectAll('.node').transition().duration(500).style('opacity',0).remove();
			}
    	},blobplot.delay);
    
}




Blobplot.prototype.toggleTaxon = function(name,bool){
	d3.selectAll('g.'+name).classed('hidden',!bool);
	this.taxa[name].visible = bool;
}

Blobplot.prototype.toggleFilter = function(name){
	this.contigFilters[name].active = this.contigFilters[name].active ? false : true;
}

Blobplot.prototype.showFilters = function(target){
	var data = []
	for( var filter in this.contigFilters ) {
    	if( this.contigFilters.hasOwnProperty( filter ) ) {
    		data.push(clone(this.contigFilters[filter]))
		}
	}
	var blobplot = this;
	var filters = d3.select('#'+target).selectAll('div.filter-options').data(data);
	var enter = filters.enter()
	var container = enter.append('div').attr('class','filter-options section');
	container.attr('rel',function(d){ return d.name; })
	container.on('mouseenter',function(){
					 	var div = d3.select(this);
						dispatch.filterpreviewstart(blobplot,div.attr('rel'))
				 })
			 .on('mouseleave',function(){
					 	var div = d3.select(this);
						dispatch.filterpreviewend(blobplot,div.attr('rel'))
				 });
	container.append('div').attr('class','filter-name');
	container.append('div').attr('class','filter-count');
	container.append('input').attr('type','checkbox')
							 .attr('class','filter-toggle')
							 .attr('rel',function(d){ return d.name; })
							 .on('click',function(){
							 	var checkbox = d3.select(this);
								blobplot.toggleFilter(checkbox.attr('rel'))
							 });
	
	filters.select('.filter-name').text(function(d){return d.name })
	filters.select('.filter-count').text(function(d){return d.contigs.length })
	
	filters.exit().remove();
}

Blobplot.prototype.applyFilters = function(){
	console.time('draw')
	console.time('filter')
	var taxa = clone(this.taxa);
	this.points = null;
	this.hexed = null;
	this.colormap = null;
	this.taxorder = null;
	this._filterContigs();
	console.timeEnd('filter')
	this.plotBlobs();
	console.timeEnd('draw');
	this.showTaxa(taxa);
	console.timeEnd('draw');
}

Blobplot.prototype.inverseFilters = function(){
	console.time('draw')
	console.time('filter')
	var taxa = clone(this.taxa);
	this.points = null;
	this.hexed = null;
	this.colormap = null;
	this.taxorder = null;
	this._inverseFilterContigs();
	console.timeEnd('filter')
	this.plotBlobs();
	console.timeEnd('draw');
	this.showTaxa(taxa);
	console.timeEnd('draw');
}



Blobplot.prototype.selectAll = function(){
	this.selectNone(1);
	var hexed = this.Hexed();
	var cells = this.cells;
	var blobplot = this;
	Object.keys(hexed).forEach(function(taxon){
		if (blobplot.taxa[taxon] && blobplot.taxa[taxon].visible){
			Object.keys(hexed[taxon]).forEach(function(bin){
				var cell = d3.select('#cell_'+bin);
				if (!cell.classed('hidden')){
					cell.classed('selected',true);
					cells[bin] = 1;
				}
			});
		}
	});
	dispatch.toggletaxa(blobplot);
	return 1;
}

Blobplot.prototype.selectCells = function(cells){
	var hexed = this.Hexed();
	cells = cells || {};
	var blobplot = this;
	Object.keys(cells).forEach(function(bin){
		var cell = d3.select('#cell_'+bin);
		if (!cell.classed('hidden')){
			cell.classed('selected',true);
		}
		else {
			delete cells[bin];
		}
	});
	dispatch.toggletaxa(blobplot);
	return 1;
}


Blobplot.prototype.simpleSelectAll = function(){
	var hexed = this.Hexed('all');
	var cells = this.cells;
	Object.keys(hexed).forEach(function(bin){
		var cell = d3.select('#cell_'+bin);
		if (!cell.classed('hidden')){
			cell.classed('selected',true);
			cells[bin] = 1;
		}
	});
	return 1;
}


Blobplot.prototype.selectNone = function(option){
	this.cells = {};
	d3.selectAll('.selected').each(function(){d3.select(this).classed('selected',false)});
	if (!option){
		dispatch.toggletaxa(this);
	}
	return 1;
}

Blobplot.prototype.listContigs = function(option){
	var contigs = [];
	var cells = this.cells;
	var hexed = this.hexed
	var hexed = this.hexed;
	var taxa = this.taxa;
	for( var taxon in hexed ) {
    	if( hexed.hasOwnProperty( taxon ) ) {
    		if (taxa[taxon] && taxa[taxon].visible){
    			for( var cell in cells) {
    				if( cells.hasOwnProperty( cell ) ) {
    					if (hexed[taxon][cell]){
    						hexed[taxon][cell].forEach(function(arr,i){
    							contigs.push(arr[2]);
    						});
    					}
    				}
    			}
    		}
    	}
    }
	return contigs;
}



/* TREEMAPS

*/

function getReadableSeqSizeString(seqSizeInBases,fixed) {
//http://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable
    
    var i = -1;
    var baseUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        seqSizeInBases = seqSizeInBases / 1000;
        i++;
    } while (seqSizeInBases >= 1000);
	fixed = fixed ? fixed : fixed == 0 ? 0 : 1;
    return Math.max(seqSizeInBases, 0.1).toFixed(fixed) + baseUnits[i];
};

Blobplot.prototype.setupTreemap = function(){
var treediv = d3.select("#treemap-plot")
    .style("position", "absolute")
    .style("width", (this.width + this.margin.left + this.margin.right) + "px")
    .style("height", (this.height + this.margin.top + this.margin.bottom) + "px")
    .style("left", this.width + this.margin.left + "px")
    .style("top", this.margin.top + "px");
}

Blobplot.prototype._addNodes = function (parent,rank,taxon,bin){
	var hexed = this.Hexed(taxon);
	if (!hexed){
		return;
	}
	var contigs = d3.values(hexed[bin]);
	var blobs = this.Blobs();
	var taxrule = this.Taxrule();
	var cov = this.Cov();
	//var rank = this.ranks[parent];
		
	var taxa = {};
	var children = [];
	contigs.forEach(function (arr,i){
		//arr[2] = contig name
		if (arr[2] && blobs[arr[2]]){
			name = blobs[arr[2]].taxonomy[taxrule][rank].t;
			if (!taxa[name]){
				taxa[name] = {}
				taxa[name].size = 0
				taxa[name].count = 0
				taxa[name].c_indices = {}
			}
			//arr[3] = contig span
			taxa[name].size += arr[3];
			taxa[name].count += 1;
			/*c_index = blobs[arr[2]].taxonomy[taxrule][rank].c;
			c_index = c_index > 1 ? 1 : c_index;
			if (!taxa[name].c_indices[c_index]){
				taxa[name].c_indices[c_index] = 0
			}
			taxa[name].c_indices[c_index]+=arr[3];*/
		}
	});
	Object.keys(taxa).forEach(function(name){
		var tmp = {};
    	tmp.name = name;
    	tmp.size = taxa[name].size;
    	tmp.count = taxa[name].count;
    		/*tmp.children = [];
    		for( var c_index in taxa[name].c_indices ) {
    			if( taxa[name].c_indices.hasOwnProperty( c_index ) ) {
    				var ttmp = {}
    				ttmp.name = c_index;
    				ttmp.size = taxa[name].c_indices[c_index];
    				tmp.children.push(ttmp);
    			}
    		}*/
		children.push(tmp);
		
	});
	return children;
}

function combine (arr1,arr2){
    var arr3 = [];
	for(var i in arr1){
   		var shared = false;
   		for (var j in arr2){
       		if (arr2[j].name == arr1[i].name) {
           		shared = true;
           		arr2[j].size += arr1[i].size;
           		arr2[j].count += arr1[i].count;
       		}
   			
   		}
   		if(!shared) arr3.push(arr1[i])
	}
	for (var j in arr2){
	arr3.push(arr2[j]);
	}
	return arr3;
}

Blobplot.prototype.generateTreemap = function(root){

	if (!root){
		root = this.Rank();
	}
	var cells = this.cells;
	var blobplot = this;
	var treemap = d3.layout.treemap()
    	.size([this.width, this.height])
    	.sticky(true)
    	.value(this.treevalue);
	
	var tree = {};
	tree.name = root;
	tree.children = [];
	// TODO: replace hack
	var active = [];
	Object.keys(this.taxa).forEach(function(taxon){
		if (blobplot.taxa[taxon].visible == true){
			active.push(taxon);
		}
	});
	active.forEach(function (taxon,index){
    	var tmp = {};
		tmp.name = taxon;
		tmp.size = 0;
		tmp.count = 0;
		var hexed = blobplot.Hexed(taxon);
		Object.keys(cells).forEach(function(bin){	
			if (hexed && hexed[bin]){
				tmp.size += hexed[bin].span;
				tmp.count += hexed[bin].length;
				if (blobplot.ranks[root] && taxon != "nh"){
					if (!tmp.children){
						tmp.children = blobplot._addNodes(root,blobplot.ranks[root],taxon,bin);
					}
					else {
						tmp.children = combine(tmp.children,blobplot._addNodes(root,blobplot.ranks[root],taxon,bin));
					}
				}
			
			}
		});
		tree.children.push(tmp);
	});
	
	this.tree = tree;
	this.treemap = treemap;
}

Blobplot.prototype.drawTreemap = function(){
	function position() {
		this.transition().duration(500)
			.style("left", function(d) { return d.x + "px"; })
			.style("top", function(d) { return d.y + "px"; })
			.style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
			.style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
	}

	var value = this.treevalue;
	var blobplot = this;
	var node = d3.select("#treemap-plot").datum(this.tree).selectAll(".node")
		.data(this.treemap.value(value).nodes);
		//.data(this.treemap.value.nodes);
  	node.enter().append("div")
  	node.attr("class", "node")
		.call(position)
		.style("background", function(d) { return d.children ? blobplot.colormap[d.name] : blobplot.colormap[d.name]})//: "grey"; })
     // .style("opacity", function(d) { return d.children ? 1 : d.name == 0 ? 0 : 0.5; })
     // .style("pointer-events", function(d) { return d.children ? 'auto' : 'none'; })
    	.attr("title", function(d) { var span = getReadableSeqSizeString(d.size); return d.children ? d.name + ': ' + span : d.name + ': ' + span})// : null ; })
    	.text(function(d) { return d.children ? null : d.name})// : null; });
	node.exit().remove()
	
	
}


/*

 TREEMAPS */ 







var blob;

d3.json("json/blob.BlobDB.smaller.json", function(error, json) {
	if (error) return console.warn(error);
	
	
	
	d3.selectAll(".top-level-heading").on('click',function(){
		var topLevel = d3.select(this.parentNode);
		topLevel.classed("open", !topLevel.classed("open"));
	});
	
	blob = new Blobplot(json,{});	
	dispatch.load(blob);

	console.time('draw')
	/*console.time('filter')
	blob.createContigFilter({	name:'gc',
								property:'gc',
								relationship:'os',
								value:[0.3,0.7]
							});
	blob.filterContigs();
	console.timeEnd('filter')*/
	
	
	d3.select('#new-filter-submit').on("click",function(){ blob.createCellFilter(document.getElementById("filter-name-input").value); blob.selectNone(); });
	d3.select('#apply-filters').on("click",function(){ blob.selectNone(); blob.applyFilters()});
	d3.select('#include-filters').on("click",function(){ blob.selectNone(); blob.inverseFilters()});
	d3.select('#select-all').on("click",function(){ blob.selectAll()});
	d3.select('#select-none').on("click",function(){ blob.selectNone()});
	d3.select('#list-contigs').on("click",function(){ console.log(blob.listContigs())});
	d3.select('#scale-by').selectAll("input").on("change", function(){dispatch.changescale(blob,this.value)});
	d3.select('#radius-scale').selectAll("input").on("change", function(){dispatch.changerscale(blob,this.value)});
	d3.select('#hex-size-slider').on('change',function(){ dispatch.resizehexes(blob,this.value);});
});

dispatch.on('load.blob',function(blob){
	blob.setupPlot();
	blob.plotBlobs();
	blob.showTaxa();
});

dispatch.on('load.menu',function(blob){
	blob.setupMenus();
});

dispatch.on('load.tree',function(blob){
	blob.setupTreemap();
});

dispatch.on('rankchange.blob',function(blob){
	// clear blob.points
	var cells = clone(blob.cells);
	blob.points = null;
	blob.hexed = null;
	blob.colormap = null;
	blob.taxorder = null;
	blob.plotBlobs();
	blob.selectCells(cells);
	blob.showTaxa();
});


dispatch.on('rankchange.tree',function(blob){
	if (Object.keys(blob.cells).length > 0){
		blob.generateTreemap();
		blob.drawTreemap();
	}
	else {
		d3.select("#treemap-plot").selectAll('.node').remove();
	}
});

dispatch.on('changescale.tree',function(blob,value){
	blob.treevalue = value === "count"
        ? function(d) { return d.count; }
        : function(d) { return d.size; };
	if (Object.keys(blob.cells).length > 0){
		blob.drawTreemap();
	}
});

dispatch.on('changescale.blob',function(blob,value){
	var cells = clone(blob.cells);
	blob.blobvalue = value === "count"
        ? function(d) { return d.length; }
        : function(d) { return d.span; };
    blob.Maxbin = value === "count"
        ? function (){ return blob.maxbincount }
        : function (){ return blob.maxbinspan; }
	blob.radius.domain([1,blob.Maxbin()])
	blob.plotBlobs();
	blob.selectCells(cells);
});

dispatch.on('changerscale.blob',function(blob,value){
	var domain = blob.radius.domain();
	var range = blob.radius.range();
	if (value == 'sqrt'){
		blob.radius = d3.scale.sqrt()
						.domain(domain)
						.range(range)
	}
	else if (value == 'log'){
		blob.radius = d3.scale.log()
						.domain(domain)
						.range(range)
	}
	else {
		blob.radius = d3.scale.linear()
						.domain(domain)
						.range(range)
	}
	blob.rscalename = value;
	var cells = clone(blob.cells);
	blob.plotBlobs();
	blob.selectCells(cells);
});


dispatch.on('toggletaxa.tree',function(blob){
	if (Object.keys(blob.cells).length > 0){
		blob.generateTreemap();
		blob.drawTreemap();
	}
	else {
		d3.select("#treemap-plot").selectAll('.node').transition().duration(500).style('opacity',0).remove();
	}
});

dispatch.on('resizebins.blob',function(blob,value){
	blob.selectNone();
	blob.binscale = value;
	blob.hexbin.radius(0.04*value)
	blob.hexed = null;
	blob.colormap = null;
	blob.taxorder = null;
	blob.plotBlobs();
});

dispatch.on('resizehexes.blob',function(blob,value){
	var cells = clone(blob.cells);
	blob.hexsize = Math.pow(2,value)/2;
	blob.radius.range([2,3.6*blob.binscale*blob.hexsize])
	blob.plotBlobs();
	blob.selectCells(cells);
});

dispatch.on('filterpreviewstart.blob',function(blob,value){
	var newblob = new Blobplot({'dict_of_blobs':blob.blobs});
	var filteredblobs = {};
	blob.contigFilters[value].contigs.forEach(function(contig,i){
		filteredblobs[contig] = newblob.blobs[contig];
	});
	newblob.filteredblobs = filteredblobs;
	newblob.previewBlobs();
	this.tmpblob = newblob;
});

dispatch.on('filterpreviewend.blob',function(blob,value){
	delete blob.tmpblob;
	blob.endPreview();
});




