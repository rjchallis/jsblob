// blobjects.js globals and objects for interactive blob plots

var dispatch = d3.dispatch("load", "select", "blobselect", "mapselect", "mapzoom", "rankchange", "filter");

function Blobplot (data,options){
	this.blobs = data.dict_of_blobs;
	
	options = options || {};
	
	var width = options.width || 900,
		height = options.height || 900;
	
	var default_options = {
        maxgroups:   7,
        rank:        'k',
        ranks:       {"k":"f","f":"o","o":"p"},
        ranknames:   {	"k":"superkingdom",
						"f":"family",
						"o":"order",
						"p":"phylum"
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
        
        radius:		d3.scale.log()
	    				.domain([1, 4000])
	    				.range([0.1, 15]),
	    hexbin:		d3.hexbin()
	    				.size([10, 10])
	    				.radius(0.1429),
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
	    				.range([height, 0])
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
	this.hexbin = options.hexbin;
	
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
	
}


Blobplot.prototype.setupMenus = function(){
	blob.showFilters('filters');
	blob.ranksDropdown('ranks');
	//blob.showTaxa('taxa');
}

Blobplot.prototype.setupPlot = function(){
	d3.select('#'+this.blobdiv).select('svg').remove();
	var svg = d3.select('#'+this.blobdiv).append("svg")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom)
        .attr("id",this.blobdiv+"_svg");
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
	    		.style("opacity", function(d) { return radius(d.length)/15; })
	    		.attr("rel", function(d) { bins[d.id] = bins[d.id] ? bins[d.id] + 1 : 1; return d.id; })
	    		.attr("d", function(d) { return hexbin.hexagon(radius(d.length)); })
	    		.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
		hexagons.exit().remove();
	groups.exit().remove();
	
	var overlay = overg.attr("clip-path", "url(#clip)").selectAll(".hexagon").data(d3.values(hexall))
	overlay.enter().append("path")
	overlay.attr("id", function(d){ return "cell_"+d.id })
	    .attr("class", function(d){ return "overlay c"+d.id })
	    .attr("rel", function(d) { return d.id; })
	    .style("stroke",function(d){return 'rgba(0,0,0,'+(0.1+bins[d.id]/20)+')'})
	    .classed("hidden",function(d){if (!bins[d.id]) {return true}})
	    .attr("d", function(d) { return hexbin.hexagon(12.5); })
	    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
	    .on("mousedown",function(){
	    	if (d3.select(this).classed("selected")){
				blobplot.dragging = 'off';
			}
			else {
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
//	    	treemap ()
	    })
	overlay.exit().remove();
}

Blobplot.prototype._filterContigs = function(){
	this.filteredblobs = clone(this.blobs);
	for( var filter in this.contigFilters ) {
    	if( this.contigFilters.hasOwnProperty( filter ) ) {
    		if (this.contigFilters[filter].active){
    			this.applyContigFilter(filter);
    		}
    	}
    }
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
	this.hexall = hexbin(all)
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

Blobplot.prototype.showTaxa = function(target){
	target = 'taxa';
	var blobplot = this;
	var colormap = this.ColorMap();
	var taxa = {};
	this.taxorder.forEach(function(taxon,i){
		taxa[taxon] = {};
		taxa[taxon].visible = true;
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
						.property('checked',function(d){ return true; })
						.on('click',function(){
							var checkbox = d3.select(this);
							blobplot.toggleTaxon(checkbox.attr('rel'),checkbox.property('checked'))
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
    		if (taxa[taxon].visible){
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
	//clearTimeout(redraw);
	if (cell.classed("selected") && this.dragging == 'off'){
		cell.classed("selected", false);
    	delete this.cells[cell.attr("rel")];
	}
	else if (this.dragging == 'on') {
		cell.classed("selected", true);
		this.cells[cell.attr("rel")] = 1;
    }
    //var delay = dragging ? 500 : 0;
    //redraw = setTimeout(function(){treemap ()},delay);
    
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
	this.filteredPoints = null;
	this.filteredOrder = null;
	this.displaypoints = null;
	this.filterContigs();
	console.timeEnd('filter')
	
	n_contigs = this.applyRules();
	console.log(n_contigs);
	if (this.Collection(this.Rank())){
		// filter taxa to display
		this.filterTaxa();
	}
	// set colours
	this.assignColors();
	
	// bin contigs
	this.binContigs();
	
	// plot blobs
	d3.select('#blob-plot > svg').remove();
	d3.select('#blob-plot > input').remove();
	this.plotBlobs('blob-plot');
	
	this.showTaxa('taxa');
	// add linear filter controls
	//blob.addAxialFilters('blob-plot');
	
	console.timeEnd('draw');
}



Blobplot.prototype.selectAll = function(){
	var hexed = this.Hexed();
	var cells = this.cells;
	var blobplot = this;
	Object.keys(hexed).forEach(function(taxon){
		if (blobplot.taxa[taxon].visible){
			Object.keys(hexed[taxon]).forEach(function(bin){
				var cell = d3.select('#cell_'+bin);
				if (!cell.classed('hidden')){
					cell.classed('selected',true);
					cells[bin] = 1;
				}
			});
		}
	});
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


Blobplot.prototype.selectNone = function(){
	this.cells = {};
	d3.selectAll('.selected').each(function(){d3.select(this).classed('selected',false)});
	return 1;
}

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
	
	
	d3.select('#new-filter-submit').on("click",function(){ blob.createCellFilter(document.getElementById("filter-name-input").value)});
	d3.select('#apply-filters').on("click",function(){ blob.applyFilters()});
	d3.select('#select-all').on("click",function(){ blob.selectAll()});
	d3.select('#select-none').on("click",function(){ blob.selectNone()});
});

dispatch.on('load.blob',function(blob){
	blob.setupPlot();
	blob.plotBlobs();
	blob.showTaxa();
});

dispatch.on('load.menu',function(blob){
	blob.setupMenus();
});

dispatch.on('rankchange.blob',function(blob){
	// clear blob.points
	blob.points = null;
	blob.hexed = null;
	blob.colormap = null;
	blob.taxorder = null;
	blob.plotBlobs();
	blob.showTaxa();
});




