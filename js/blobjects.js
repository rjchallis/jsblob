// blobjects.js globals and objects for interactive blob plots



function Blobplot (data){
	this.blobs = data.dict_of_blobs;
	
	this.ranknames = {	"k":"superkingdom",
						"f":"family",
						"o":"order",
						"p":"phylum"};
	this.ranks = {"k":"f","f":"o","o":"p"};
	this.rank = "k";
	
	this.taxrules = {"bestsum":1};
	this.taxrule = "bestsum";
	
	this.covs = {"cov0":1,"cov1":2,"cov2":3,"cov3":2};
	this.cov = "cov0";
	
	this.maxgroups = 7;
	this.collection = {}; // bin taxa, e.g. all bacteria at family level
	
	this.palette = d3.scale.category10();
	
	this.contigFilters = {};
	
	this.dragging = false;
	this.cells = {};
	
	
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
	
	if (!this.filteredblobs){
		this.filteredblobs = this.blobs;
	}
	
	// select taxrule, rank and coverage
	for( var contig in this.filteredblobs ) {
    	if( this.filteredblobs.hasOwnProperty( contig ) ) {
    		if (!points[this.filteredblobs[contig].taxonomy[this.taxrule][this.rank].t]){
    			points[this.filteredblobs[contig].taxonomy[this.taxrule][this.rank].t] = [];
    		}
    		points[this.filteredblobs[contig].taxonomy[this.taxrule][this.rank].t].push([this.filteredblobs[contig].gc*10,Math.log10(this.filteredblobs[contig].covs[this.cov] + 0.001),contig,this.filteredblobs[contig].len]);
    		ctr++;
    	}
	}
	this.points = points;
	this.taxorder = getSortedKeys(points);
	return ctr;
}

Blobplot.prototype.ranksDropdown = function(target){
	var select = d3.select('#'+target).append('select');
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
	select.on('change',function(){blobplot.Rank(this.options[this.selectedIndex].value); blobplot.applyFilters();})
}

Blobplot.prototype.showTaxa = function(target){
	var blobplot = this;
	var taxa = d3.select('#'+target).selectAll('.taxon-options').data(blobplot.taxorder);
	taxa.enter().append('div').attr('class','.taxon-options');
	
	//taxa.html('');
	taxa.attr('rel',function(d){return d});
	taxa.append('div')
		.attr('class','tax-select')
	var checkbox = taxa.append('input').attr('type','checkbox')
						.attr('class','taxon-toggle')
						.attr('rel',function(d){ return d.name; })
						.property('checked',function(d){ return true; })
						.on('click',function(){
							var checkbox = d3.select(this);
							blobplot.toggleTaxon(checkbox.attr('rel'))
						});
	taxa.append('div')
		.attr('class','tax-color')
		.style('background-color',function(d){return blobplot.colormap[d]});
	taxa.append('div')
		.text(function(d){return d});
	
	taxa.exit().remove();
	// TODO!
	
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
	if (!this.filteredOrder){
		this.filteredOrder = this.taxorder;
	}
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
	for( var taxon in hexed ) {
    	if( hexed.hasOwnProperty( taxon ) ) {
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
    this.contigFilters[filter.name] = filter;
    this.cells = {};
    d3.selectAll('.selected').classed('selected',false)
    this.showFilters('filters');
}


Blobplot.prototype.filterContigs = function(){
	this.filteredblobs = clone(this.blobs);
	for( var filter in this.contigFilters ) {
    	if( this.contigFilters.hasOwnProperty( filter ) ) {
    		if (this.contigFilters[filter].active){
    			this.applyContigFilter(filter);
    		}
    	}
    }
}

Blobplot.prototype.applyContigFilter = function(name){
	var filteredblobs = this.filteredblobs;
	this.contigFilters[name].contigs.forEach(function(contig,i){
		delete filteredblobs[contig];
	});
}


Blobplot.prototype.binContigs = function(){
	var hexed = {};
	for( var taxon in this.points ) {
    	if( this.points.hasOwnProperty( taxon ) ) {
    		hexed[taxon] = this.hexbin(this.points[taxon])
		}
	}
	this.hexed = hexed;
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

Blobplot.prototype.plotBlobs = function(target){
	var svg = d3.select('#'+target).append("svg")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom)
        .attr("id",target+"_svg")
        .append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

	svg.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("class", "mesh")
        .attr("width", this.width)
        .attr("height", this.height);

	svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);

	var hexg = svg.append("g");
	var overg = svg.append("g").attr("clip-path", "url(#clip)");

	var hexed = this.hexed;
	var radius = this.radius;
	var colormap = this.colormap;
	var hexbin = this.hexbin;
	var x = this.x;
	var y = this.y;
	
	var blobplot = this;
	
	for( var taxon in hexed ) {
	    if( hexed.hasOwnProperty( taxon ) ) {
	    	hexg.append("g")
	    		.attr("clip-path", "url(#clip)")
	    		.attr("class", taxon)
	  			.selectAll(".hexagon")
	    		.data(d3.values(hexed[taxon]))
	  			.enter().append("path")
	    			.attr("class", "hexagon")
	    			.style("fill", colormap[taxon])
	    			.style("opacity", function(d) { return radius(d.length)/15; })
	    			.attr("rel", function(d) { return d.id; })
	    			.attr("d", function(d) { return hexbin.hexagon(radius(d.length)); })
	    			.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
	    //.on("click",function(){treemap (d3.select(this).attr("rel"))})
	    //.append("svg:title")
	    //      .text(function(d, i) { return d.length; });
	    
	    
	    	overg.append("g")
	    		.attr("clip-path", "url(#clip)")
	    		.attr("class", taxon)
	  			.selectAll(".hexagon")
	    		.data(d3.values(hexed[taxon]))
	  			.enter().append("path")
	    			.attr("class", "overlay")
	    			.attr("rel", function(d) { return d.id; })
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
//	    				treemap ()
	    			})
	   	 
		}
	}
	
}

Blobplot.prototype.toggleTaxon = function(name){
	d3.selectAll('g.'+name).classed('hidden',true);
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
	
	// add linear filter controls
	//blob.addAxialFilters('blob-plot');
	
	console.timeEnd('draw');
}


/*Blobplot.prototype.addAxialFilters = function(target){
	var svg = d3.select('#'+target+'_svg');
    var gc = svg.append('g')
    	.attr("width", this.width)
    	.attr("height", this.margin.top)
        .attr("transform", "translate(" + this.margin.left + ",0)");

	var drag = d3.behavior.drag()
        .on("drag", function(d,i) {
            d.x += d3.event.dx
            d.y += d3.event.dy
            d3.select(this).attr("transform", function(d,i){
                return "translate(" + [ d.x,d.y ] + ")"
            })
        });

	var data = [{x:this.x(0),y:0,w:this.margin.top/2,h:this.margin.top/2},{x:this.x(1),y:0,w:-this.margin.top/2,h:this.margin.top/2}]
	gc.selectAll('polygon').data(data).enter().append('polygon')
    	.attr("points", function(d){ 	return "0,"+d.y+" 0,"+(d.y+d.h)+" "+d.w+","+(d.y+d.h/2) 
    								})
    	//.attr("width", this.margin.top)
    	//.attr("height", this.margin.top)
    	.call(drag)
		
	gc.append('polygon')
    	.attr("points", this.width+","+this.margin.top/2+" "+this.width+","+this.margin.top+" "+(this.width-this.margin.top/2)+","+3*this.margin.top/4 )
    	.call(drag)
}*/


var blob;

d3.json("json/blob.BlobDB.smaller.json", function(error, json) {
	if (error) return console.warn(error);
	
	d3.selectAll(".top-level-heading").on('click',function(){
		var topLevel = d3.select(this.parentNode);
		topLevel.classed("open", !topLevel.classed("open"));
	});
	
	blob = new Blobplot(json);
	console.time('draw')
	console.time('filter')
	blob.createContigFilter({	name:'gc',
								property:'gc',
								relationship:'os',
								value:[0.3,0.7]
							});
	blob.filterContigs();
	console.timeEnd('filter')
	
	n_contigs = blob.applyRules();
	console.log(n_contigs);
	//blob.Collection(blob.Rank(),['-'],'exclude')
	if (blob.Collection(blob.Rank())){
		// filter taxa to display
		blob.filterTaxa();
	}
	// set colours
	blob.assignColors();
	
	// bin contigs
	blob.binContigs();
	
	// plot blobs
	blob.plotBlobs('blob-plot');
	
	// add linear filter controls
	//blob.addAxialFilters('blob-plot');
	
	console.timeEnd('draw');
	
	blob.showFilters('filters');
	
	
	blob.ranksDropdown('ranks');
	blob.showTaxa('taxa');
	
	d3.select('#new-filter-submit').on("click",function(){ blob.createCellFilter(document.getElementById("filter-name-input").value)});
	d3.select('#apply-filters').on("click",function(){ blob.applyFilters()});
});




