

function json2csv(json) {
	var text = "";
	$.each( json, function( key, value ) {
		text += key + "," + value + "\n";
	});
	
	text = text.slice(0,-1);
	return text;
}


// Dimensions of sunburst.
var width;
var height;
var radius;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 125, h: 30, s: 3, t: 10
};

// Mapping of step names to colors.
var origcolors = {
	"positive": "#507c02",
	"negative": "#a3080a",
	"neutral":  "#888"
};

var colors = {};

var huetype = [ "blue", "orange", "purple" ];

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0; 

var vis;
var partition;
var arc;

// Use d3.text and d3.csv.parseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
//d3.text("data/visit-sequences.csv", function(text) 

function getVis2InputJson() {
	var cat1name = $('#vis2cat1name').val();
	var cat1keys = $('#vis2cat1keywords').val();
	var cat2name = $('#vis2cat2name').val();
	var cat2keys = $('#vis2cat2keywords').val();
	var websites = $('#vis2websites').val();
	var startday = $('#vis2startday').val();
	var endday   = $('#vis2endday').val();
	var startts  = date2timestamp(startday);
	var endts    = date2timestamp(endday);
	
	return JSON.stringify({	cat1name: cat1name, cat1keys: cat1keys, 
		cat2name: cat2name, cat2keys: cat2keys,
		websites: websites, startts: startts, endts: endts});
}

function date2timestamp(myDate) {
	myDate=myDate.split("-");
	var newDate=myDate[1]+"/"+myDate[2]+"/"+myDate[0];
	var ts = new Date(newDate).getTime();
	console.log(ts);
	return ts;
}


function visualization2_generate(error,json) {
	console.log("Entering visualization2_generate()");
	console.log(json);
	//
	if(error) { 
		handle_error(error);
		return;
	}
	//
	
	//////////////////////////////////////
	
	$("#chartVis2").append('<div id="seqmain">'+
		    '<div id="sequence"></div>'+
		    '<div id="chart">'+
		    	'<div id="explanation" style="visibility: hidden; color: white;">'+
		        	'<span id="percentage"></span><br/>'+
		        		'of mentions in this category.'+
		        '</div>'+
		    '</div>'+
	    '</div>'+
	    '<div id="seqsidebar">'+
	    	'<input type="checkbox" id="togglelegend"> Legend<br/>'+
	    	'<div id="legend" style="visibility: hidden;"></div>'+
	    '</div>'+
	    '<script type="text/javascript" src="js/sequences.js"></script>'+
	    '<script type="text/javascript">'+
	    	'd3.select(self.frameElement).style("height", "700px");'+
	    '</script>');
	
	// Dimensions of sunburst.
	width = 750;
	height = 600;
	radius = Math.min(width, height) / 2;
	
	vis = d3.select("#chart").append("svg:svg")
	    .attr("width", width)
	    .attr("height", height)
	    .append("svg:g")
	    .attr("id", "container")
	    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
	
	partition = d3.layout.partition()
	    .size([2 * Math.PI, radius * radius])
	    .value(function(d) { return d.size; });

	arc = d3.svg.arc()
	    .startAngle(function(d) { return d.x; })
	    .endAngle(function(d) { return d.x + d.dx; })
	    .innerRadius(function(d) { return Math.sqrt(d.y); })
	    .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });
	
	console.warn(vis);
	
	//////////////////////////////////////
	
	//d3.text("http://127.0.0.1:8081/eu.leads.api/file?name=vis2-sample.csv", function(text) {
	
	var text = json2csv(json);
	var csv = d3.csv.parseRows(text);
	console.warn(csv);
	var json = buildHierarchy(csv);
	console.log(JSON.stringify(json));

  // Basic setup of page elements.
  initializeBreadcrumbTrail();
  drawLegend();
  d3.select("#togglelegend").on("click", toggleLegend);

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle")
      .attr("r", radius)
      .style("opacity", 0);

  // For efficiency, filter nodes to keep only those large enough to see.
  var nodes = partition.nodes(json)
      .filter(function(d) {
      return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
      });

  var path = vis.data([json]).selectAll("path")
      .data(nodes)
      .enter().append("svg:path")
      .attr("display", function(d) { return d.depth ? null : "none"; })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
//      .style("fill", function(d) { return colors[d.name]; })
      .style("fill",function(d) { console.log(d.name + " - " + d.depth); return colors[d.depth+"."+d.name]; })
      .style("opacity", 1)
      .on("mouseover", mouseover);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Get total size of the tree = value of root node from partition.
  console.log("path.node():");
  console.log(path);
  totalSize = path.node().__data__.value;
  
  var height = $("#seqmain").height();
  $("#chartContainer").css("height",height);
 };

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {

  var percentage = (100 * d.value / totalSize).toPrecision(3);
  var percentageString = percentage + "%";
  if (percentage < 0.1) {
    percentageString = "< 0.1%";
  }

  d3.select("#percentage")
      .text(percentageString);

  d3.select("#explanation")
      .style("visibility", "");

  var sequenceArray = getAncestors(d);
  updateBreadcrumbs(sequenceArray, percentageString);

  // Fade all the segments.
  d3.selectAll("path")
      .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis.selectAll("path")
      .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
              })
      .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {

  // Hide the breadcrumb trail
  d3.select("#trail")
      .style("visibility", "hidden");

  // Deactivate all segments during transition.
  d3.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  d3.selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .each("end", function() {
              d3.select(this).on("mouseover", mouseover);
            });

  d3.select("#explanation")
      .style("visibility", "hidden");
}

// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
  var path = [];
  var current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  var trail = d3.select("#sequence").append("svg:svg")
      .attr("width", width)
      .attr("height", 50)
      .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  var points = [];
  points.push("0,0");
  points.push(b.w + ",0");
  points.push(b.w + b.t + "," + (b.h / 2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + "," + (b.h / 2));
  }
  return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {

  // Data join; key function combines name and depth (= position in sequence).
  var g = d3.select("#trail")
      .selectAll("g")
      .data(nodeArray, function(d) { return d.name + d.depth; });

  // Add breadcrumb and label for entering nodes.
  var entering = g.enter().append("svg:g");

  entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .style("fill", function(d) { return colors[d.depth+"."+d.name]; });

  entering.append("svg:text")
      .attr("x", (b.w + b.t) / 2)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.name; });

  // Set position for entering and updating nodes.
  g.attr("transform", function(d, i) {
    return "translate(" + i * (b.w + b.s) + ", 0)";
  });

  // Remove exiting nodes.
  g.exit().remove();

  // Now move and update the percentage at the end.
  d3.select("#trail").select("#endlabel")
      .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(percentageString);

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail")
      .style("visibility", "");

}

function drawLegend() {

  // Dimensions of legend item: width, height, spacing, radius of rounded rect.
  var li = {
    w: 100, h: 30, s: 3, r: 3
  };

  var legend = d3.select("#legend").append("svg:svg")
      .attr("width", li.w)
      .attr("height", d3.keys(colors).length * (li.h + li.s));

  var g = legend.selectAll("g")
      .data(d3.entries(colors))
      .enter().append("svg:g")
      .attr("transform", function(d, i) {
              return "translate(0," + i * (li.h + li.s) + ")";
           });

  g.append("svg:rect")
      .attr("rx", li.r)
      .attr("ry", li.r)
      .attr("width", li.w)
      .attr("height", li.h)
      .style("fill", function(d) { return d.value; });

  g.append("svg:text")
      .attr("x", li.w / 2)
      .attr("y", li.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.key.substring(d.key.indexOf(".")+1); });
}

function toggleLegend() {
  var legend = d3.select("#legend");
  if (legend.style("visibility") == "hidden") {
    legend.style("visibility", "");
  } else {
    legend.style("visibility", "hidden");
  }
}

// Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how 
// often that sequence occurred.
function buildHierarchy(csv) {
  var root = {"name": "root", "children": []};
  for (var i = 0; i < csv.length; i++) {
    var sequence = csv[i][0];
    var size = +csv[i][1];
    if (isNaN(size)) { // e.g. if this is a header row
      continue;
    }
    // TODO choose order of dimensions
    var parts = sequence.split("-");
    var currentNode = root;
    var colorLayer = 0;
    for (var j = 0; j < parts.length; j++) {
      var children = currentNode["children"];
      var nodeName = parts[j];
      var colorId = (j+1)+"."+nodeName;
      if(origcolors[nodeName]===undefined) {
    	  colors[colorId] = randomColor({hue:huetype[colorLayer]});
    	  colorLayer++;
      }
      else
    	  colors[colorId] = origcolors[nodeName];
      console.log(colorId+" color = "+colors[colorId]);
      var childNode;
      if (j + 1 < parts.length) {
   // Not yet at the end of the sequence; move down the tree.
 	var foundChild = false;
 	for (var k = 0; k < children.length; k++) {
 	  if (children[k]["name"] == nodeName) {
 	    childNode = children[k];
 	    foundChild = true;
 	    break;
 	  }
 	}
  // If we don't already have a child node for this branch, create it.
 	if (!foundChild) {
 	  childNode = {"name": nodeName, "children": []};
 	  children.push(childNode);
 	}
 	currentNode = childNode;
      } else {
 	// Reached the end of the sequence; create a leaf node.
 	childNode = {"name": nodeName, "size": size};
 	children.push(childNode);
      }
    }
  }
  console.log(colors);
  sortObject(colors);
  console.log(colors);
  return root;
};

function sortObject(obj) {
    return Object.keys(obj).sort().reduce(function (result, key) {
        result[key] = obj[key];
        return result;
    }, {});
}