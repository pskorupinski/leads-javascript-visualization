/**
 * 
 */

function connectREST(name,json,method) {
	var url = "http://127.0.0.1:8081/eu.leads.api/"+name+"?inputJSON="+json;
	d3.json(url,method);
}

function handle_error(error) {
	console.warn("Error during connective to server");
	console.warn(error);
}

function weekInputToTimestamp(str,isend) {
	var res = str.split("-W");
	if(res.length!==2)
		return null;
	
	var week = parseInt(res[1]);
	var year = parseInt(res[0]);
	
	if(isend) week += 1;
	
	var date = getDateOfISOWeek(week,year);
	console.log(date);
	var timestamp = date.getTime();
	
	return timestamp;
}

function getDateOfISOWeek(w, y) {
    var simple = new Date(y, 0, 1 + (w - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

function onVisInputReady(id) {
	$("#chartVis"+id).empty();
	
	var name = "";
	var inputJson = "";
	var method = "";
	
	if(id===1) {
		name		= "VIS1";
		inputJson 	= getVis1InputJson();
		method		= visualization1_generate;
	}
	else if(id===2) {
		name		= "VIS2";
		inputJson 	= getVis2InputJson();
		method		= visualization2_generate;
	}
	else if(id===3) {
		name		= "VIS3";
		inputJson 	= getVis3InputJson();
		method		= visualization3_generate;
	}

	connectREST(name,inputJson,method);
}

function getVis1InputJson() {
	var keywords = $('#vis1keywords').val();
	var websites = $('#vis1websites').val();
	var startweek= $('#vis1startweek').val();
	var endweek  = $('#vis1endweek').val();
	
	var periodstart = weekInputToTimestamp(startweek));
	var periodend   = weekInputToTimestamp(endweek,true));
	
	return JSON.stringify({
		keywords:    keywords, 
		websites:    websites, 
		periodstart: periodstart, 
		periodend:   periodend});
}

function maxVis1Array(array) {
	console.log(array);
	return array.reduce(function(a,b) {
		
		var price1 = a["Product Price"] === undefined ? a : a["Product Price"];
		var price2 = b["Product Price"] === undefined ? b : b["Product Price"];
		console.log(price1+", "+price2);
		return Math.max(price1,price2);
	});
}

/*
 * TODO:
 *  - put callback separately and add error handling
 *  - in the meantime, add some content, like Waiting...
 *  - the products not present in the week disappear
 */
function visualization1_generate(error,data) {
	//
	if(error) { 
		handle_error(error);
		return;
	}
	//
	
    var svg = dimple.newSvg("#chartVis1", "100%", 400);
	var maxY = maxVis1Array(data);

    data = dimple.filterData(data, "Week", ["Week 1", "Week 2"]);

    // Create the indicator chart on the right of the main chart
    var indicator = new dimple.chart(svg, data);

    // Pick blue as the default and orange for the selected month
    var defaultColor = indicator.defaultColors[0];
    var indicatorColor = indicator.defaultColors[2];

    // The frame duration for the animation in milliseconds
    var frame = 5000;

    var firstTick = true;

    // Place the indicator bar chart to the right
    indicator.setBounds(434, 49, 153, 311);

    // Add dates along the y axis
    var y = indicator.addCategoryAxis("y", "Week");
    y.addOrderRule("Week", "Asc");

    // Use sales for bar size and hide the axis
    var x = indicator.addMeasureAxis("x", "Product Name");
    x.hidden = true;

    // Add the bars to the indicator and add event handlers
    var s = indicator.addSeries(null, dimple.plot.bar);
    s.addEventHandler("click", onClick);
    // Draw the side chart
    indicator.draw();

    // Remove the title from the y axis
    y.titleShape.remove();

    // Remove the lines from the y axis
    y.shapes.selectAll("line,path").remove();

    // Move the y axis text inside the plot area
    y.shapes.selectAll("text")
            .style("text-anchor", "start")
            .style("font-size", "11px")
            .attr("transform", "translate(18, 0.5)");

    // This block simply adds the legend title. I put it into a d3 data
    // object to split it onto 2 lines.  This technique works with any
    // number of lines, it isn't dimple specific.
    svg.selectAll("title_text")
            .data(["Click bar to select",
                "and pause. Click again",
                "to resume animation"])
            .enter()
            .append("text")
            .attr("x", 435)
            .attr("y", function (d, i) { return 15 + i * 12; })
            .style("font-family", "sans-serif")
            .style("font-size", "10px")
            .style("color", "Black")
            .text(function (d) { return d; });

    // Manually set the bar colors
    s.shapes
            .attr("rx", 10)
            .attr("ry", 10)
            .style("fill", function (d) { return (d.y === 1 ? indicatorColor.fill : defaultColor.fill) })
            .style("stroke", function (d) { return (d.y === 1 ? indicatorColor.stroke : defaultColor.stroke) })
            .style("opacity", 0.4);

    // Draw the main chart
    var bubbles = new dimple.chart(svg, data);
    bubbles.setBounds(60, 50, 355, 310);
    bubbles.addCategoryAxis("x", "Shop");
    var priceAxis = bubbles.addMeasureAxis("y", "Product Price");
    priceAxis.overrideMax = 1.1*maxY;
    var serie = bubbles.addSeries(["Product Name","Category"], dimple.plot.bubble);
    bubbles.addLegend(60, 10, 410, 60);

    // Add a storyboard to the main chart and set the tick event
    var story = bubbles.setStoryboard("Week", onTick);
    // Change the frame duration
    story.frameDuration = frame;
    // Order the storyboard by date
    story.addOrderRule("Week");

    // Draw the bubble chart
    bubbles.draw();

    // Orphan the legends as they are consistent but by default they
    // will refresh on tick
    bubbles.legends = [];
    // Remove the storyboard label because the chart will indicate the
    // current month instead of the label
    story.storyLabel.remove();

    // On click of the side chart
    function onClick(e) {
        // Pause the animation
        story.pauseAnimation();
        // If it is already selected resume the animation
        // otherwise pause and move to the selected month
        if (e.yValue === story.getFrameValue()) {
            story.startAnimation();
        } else {
            story.goToFrame(e.yValue);
            story.pauseAnimation();
        }
    }

    // On tick of the main charts storyboard
    function onTick(e) {
        if (!firstTick) {
            // Color all shapes the same
            s.shapes
                    .transition()
                    .duration(frame / 2)
                    .style("fill", function (d) { return (d.y === e ? indicatorColor.fill : defaultColor.fill) })
                    .style("stroke", function (d) { return (d.y === e ? indicatorColor.stroke : defaultColor.stroke) })
                    .style("opacity", function (d) { return (d.yValue === 0 ? 0 : 0.8); });
        }
        firstTick = false;
    }
}
