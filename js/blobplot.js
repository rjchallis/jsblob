
var data; // a global
var mesh;

d3.json("json/blob.BlobDB.smaller.json", function(error, json) {
  if (error) return console.warn(error);
  data = json.dict_of_blobs;
  do_stuff()
});


var margin = {top: 20, right: 20, bottom: 40, left: 40},
    width = 960 - margin.left - margin.right,
    height = 960 - margin.top - margin.bottom;

var radius = d3.scale.log()
    .domain([1, 4000])
    .range([0.1, 15]);

var hexbin = d3.hexbin()
    .size([10, 10])
    .radius(0.1429);

var x = d3.scale.linear()
    .domain([0, 10])
    .range([0, width]);

var y = d3.scale.linear()
    .domain([-4, 6])
    .range([height, 0]);
    
var xax = d3.scale.linear()
	.domain([0, 1])
	.range([0, width]);
	
var yax = d3.scale.log()
	.domain([0.0001, 1000000])
	.range([height, 0]);

var xAxis = d3.svg.axis()
    .scale(xax)
    .orient("bottom")
    .tickSize(6, -height);

var yAxis = d3.svg.axis()
    .scale(yax)
    .orient("left")
    .tickSize(6, -width);

var base = d3.select("body").append("div").attr("id","plot");
var raster = base.append("div").style("position","absolute").style("top",margin.top+"px").style("left",margin.left+"px");
var vector = base.append("div").style("position","absolute").style("top","0px").style("left","0px");
      

var svg = vector.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

svg.append("clipPath")
    .attr("id", "clip")
  .append("rect")
    .attr("class", "mesh")
    .attr("width", width)
    .attr("height", height);


svg.append("g")
    .attr("class", "y axis")
    .call(yAxis);

svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis);

var hexed = {};
var cells = {};
var active = ["-","Bacteria","Eukaryota"];
var root = "k";
var ranks = {"k":"f","f":"o","o":"p"};
var cols = [];
cols["-"] = "grey";
cols["Bacteria"] = "yellow";
cols["Eukaryota"] = "green";
var dragging = false;
var redraw;

var treediv = d3.select("body").append("div")
    .attr("id", "treemap")
    .style("position", "relative")
    .style("width", (width + margin.left + margin.right) + "px")
    .style("height", (height + margin.top + margin.bottom) + "px")
    .style("left", width + margin.left + "px")
    .style("top", margin.top + "px");

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

function addNodes (rank,parent,taxon,bin){
	var contigs = d3.values(hexed[taxon][bin]);
	var taxa = {};
	var children = [];
	contigs.forEach(function (arr,i){
		if (arr[2] && data[arr[2]]){
			name = data[arr[2]].taxonomy.bestsum[rank].t;
			if (!taxa[name]){
				taxa[name] = {}
				taxa[name].size = 0
				taxa[name].c_indices = {}
			}
			taxa[name].size += arr[3];
			c_index = data[arr[2]].taxonomy.bestsum[parent].c;
			c_index = c_index > 1 ? 1 : c_index;
			if (!taxa[name].c_indices[c_index]){
				taxa[name].c_indices[c_index] = 0
			}
			taxa[name].c_indices[c_index]+=arr[3];
		}
	});
	for( var name in taxa ) {
    	if( taxa.hasOwnProperty( name ) ) {
    		var tmp = {};
    		tmp.name = name;
    		tmp.size = taxa[name].size;
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
		}
	}
	return children;
}

function toggleCell (el){
	var cell = d3.select(el)
	//clearTimeout(redraw);
	if (cell.classed("selected")){
		cell.classed("selected", false);
    	delete cells[cell.attr("rel")];
	}
	else {
		cell.classed("selected", true);
		cells[cell.attr("rel")] = 1;
    }
    //var delay = dragging ? 500 : 0;
    //redraw = setTimeout(function(){treemap ()},delay);
    
}

function combine (arr1,arr2){
    var arr3 = [];
	for(var i in arr1){
   		var shared = false;
   		for (var j in arr2){
       		if (arr2[j].name == arr1[i].name) {
           		shared = true;
           		arr2[j].size += arr1[i].size;
       		}
   			
   		}
   		if(!shared) arr3.push(arr1[i])
	}
	for (var j in arr2){
	arr3.push(arr2[j]);
	}
	return arr3;
}

function treemap (){
	var treemap = d3.layout.treemap()
    .size([width, height])
    .sticky(true)
    .value(function(d) { return d.size; });

	
	var tree = {};
	tree.name = root;
	tree.children = [];
	
	active.forEach(function (taxon,index){
    var tmp = {};
			tmp.name = taxon;
			tmp.size = 0;
			for( var bin in cells ) {
    if( cells.hasOwnProperty( bin ) ) {
		if (hexed[taxon] && hexed[taxon][bin]){
			tmp.size += hexed[taxon][bin].span;
			if (ranks[root] && taxon != "-"){
				if (!tmp.children){
					tmp.children = addNodes(ranks[root],root,taxon,bin);
				}
				else {
					tmp.children = combine(tmp.children,addNodes(ranks[root],root,taxon,bin));
				}
			}
			
		}
	}}
	tree.children.push(tmp);
	});
	//var color = d3.scale.category20c();



  var node = treediv.datum(tree).selectAll(".node")
      .data(treemap.nodes);
  node.enter().append("div")
  node.attr("class", "node")
      .call(position)
      .style("background", function(d) { return d.children ? cols[d.name] : cols[d.name]})//: "grey"; })
     // .style("opacity", function(d) { return d.children ? 1 : d.name == 0 ? 0 : 0.5; })
     // .style("pointer-events", function(d) { return d.children ? 'auto' : 'none'; })
      .attr("title", function(d) { var span = getReadableSeqSizeString(d.size); return d.children ? d.name + ': ' + span : d.name + ': ' + span})// : null ; })
      .text(function(d) { return d.children ? null : d.name})// : null; });
  node.exit().remove()
  


function position() {
  this.transition().duration(500)
      .style("left", function(d) { return d.x + "px"; })
      .style("top", function(d) { return d.y + "px"; })
      .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
      .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
}

	
	
}

function do_stuff(){
  
	var chart = raster.append("canvas")
        .attr("width", width )
    	.attr("height", height )
        .style("position","absolute")
        //.attr("class","x"+x+"y"+y)
    var context = chart.node().getContext("2d");

var points = {};
points["-"] = [];
points["Bacteria"] = [];
points["Eukaryota"] = [];


for( var blob in data ) {
    if( data.hasOwnProperty( blob ) ) {
    /*	context.beginPath();
    	context.arc(x(data[blob].gc*10), y(Math.log(data[blob].covs.cov0 + 0.001)), radius(data[blob]["len"]), 0, 2*Math.PI,false);
    	col =  cols[data[blob].taxonomy.bestsum.k.t] || "rgba(0,0,255,0.05)";
    	context.fillStyle=col;
        context.fill();
        context.closePath();*/
        if (points[data[blob].taxonomy.bestsum.k.t]){
    		points[data[blob].taxonomy.bestsum.k.t].push([data[blob].gc*10,Math.log10(data[blob].covs.cov0 + 0.001),blob,data[blob].len]);
    	}
    	
    }
    // plot canvas of covs[cov0], gc, length
  }

var hexg = svg.append("g");
var overg = svg.append("g").attr("clip-path", "url(#clip)");
for( var taxon in points ) {
    if( points.hasOwnProperty( taxon ) ) {
    	hexed[taxon] = hexbin(points[taxon])
hexg.append("g")
    .attr("clip-path", "url(#clip)")
  .selectAll(".hexagon")
    .data(d3.values(hexed[taxon]))
  .enter().append("path")
    .attr("class", "hexagon")
    .style("fill", cols[taxon])
    .style("opacity", function(d) { return radius(d.length)/15; })
    .attr("rel", function(d) { return d.id; })
    .attr("d", function(d) { return hexbin.hexagon(radius(d.length)); })
    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
    //.on("click",function(){treemap (d3.select(this).attr("rel"))})
    //.append("svg:title")
    //      .text(function(d, i) { return d.length; });
    
    
    overg.selectAll(".hexagon")
    .data(d3.values(hexed[taxon]))
  .enter().append("path")
    .attr("class", "overlay")
    .attr("rel", function(d) { return d.id; })
    .attr("d", function(d) { return hexbin.hexagon(12.5); })
    .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; })
    .on("mousedown",function(){
    	dragging = true;
    	toggleCell(this);
    	})
    .on("mouseover",function(){
    	if (dragging){
    		toggleCell(this);
    	}
    	})
    .on("mouseup",function(){
    	dragging = false;
    	treemap ()
    	})
    
    //.append("svg:title")
    //      .text(function(d, i) { return d.length; });
    }
}






}



// OBJECTS

// BlobDB

// Plot

// Bin

// BinPlot

// 

// METHODS

// load json

// split taxa

// lump taxa

// prepare plot area

// hexbin data

// plot canvas blobs

// show canvas blobs

// hide canvas blobs

// plot bin blobs

// show bin blobs

// hide bin blobs

// show taxon

// hide taxon

// plot bins

// show bins

// hide bins

// select bin

// unselect bin



//var randomX = d3.random.normal(5, 1),
//    randomY = d3.random.normal(5, 1),
//    points = d3.range(2000).map(function() { return [randomX(), randomY()]; });







