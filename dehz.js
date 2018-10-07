var dehz = function(){
	var NUM_SHADE = 10,
		data, currentLevel, progress, tiles, activeTile, history, classPackAll, classShadeAll;

	var sign = Math.sign || function(x){return x?(x>0?1:-1):0};

	function rgba(color,alpha){
		return "rgba("+color.r+","+color.g+","+color.b+","+(alpha||color.a/255)+")";
	}

	function setView(v){
		["mainMenu","packMenu","levelMenu","puzzle"].forEach(function(id){
			document.getElementById(id).classList[id===v?"remove":"add"]("noshow");
		});
	}

	function clickTile(){
		var r = +this.firstChild.dataset.r,
			c = +this.firstChild.dataset.c,
			isDot = tiles[r][c].classList.contains("dot"),
			isWin = false;
		/* Clear dots */
		tiles.forEach(function(row){row.forEach(function(t){t.classList.remove("dot","blink")})});
		/* Range tile */
		if( +tiles[r][c].dataset.range > 0 ){
			[].concat(
				getRange(r,c,tiles[r][c].dataset.range, 1, 0),
				getRange(r,c,tiles[r][c].dataset.range,-1, 0),
				getRange(r,c,tiles[r][c].dataset.range, 0, 1),
				getRange(r,c,tiles[r][c].dataset.range, 0,-1)
			).forEach(function(t){t.classList.add("dot","blink")});
			activeTile = {r:r,c:c,range:tiles[r][c].dataset.range};
			return;
		}
		/* Dot tile */
		else if( isDot ){
			history.push([]);
			getRange(activeTile.r,activeTile.c,activeTile.range,sign(c-activeTile.c),sign(r-activeTile.r),"tile").forEach(function(t){
				history[history.length-1].push(t);
				if( t.dataset.range === "-1" ){
					t.classList.remove("goal");
					isWin = true;
				}
				t.classList.add("tile");
				t.dataset.range = 0;
			});
			history[history.length-1].push({
				t: tiles[activeTile.r][activeTile.c],
				range: tiles[activeTile.r][activeTile.c].dataset.range,
				dx: sign(c-activeTile.c),
				dy: sign(r-activeTile.r),
				x: activeTile.c,
				y: activeTile.r
			});
			tiles[activeTile.r][activeTile.c].innerHTML = "";
			tiles[activeTile.r][activeTile.c].dataset.range = 0;
			history = history;
			if( isWin ) finishLevel();
		}
		activeTile = undefined;
	}

	function getRange(r,c,range,dx,dy){
		var t = [];
		r += dy;
		c += dx;
		while( range && c >= 0 && c < data.levels[currentLevel].cols && r >= 0 && r < data.levels[currentLevel].rows ){
			if( +tiles[r][c].dataset.range < 0 ){
				t.push(tiles[r][c]);
				range--;
			}
			c += dx;
			r += dy;
		}
		return t;
	}

	function finishLevel(){
		/* Update progress */
		if( progress.indexOf(currentLevel) === -1 ){
			progress.push(currentLevel)
			progress.sort(function(a,b){return a-b});
		}
		localStorage.setItem("dehz-progress",JSON.stringify(progress));
		/* Set all tiles to same background shade */
		tiles.forEach(function(row){
			row.forEach(function(t){
				t.parentNode.classList.add(classShadeAll[3]);
				DOMTokenList.prototype.remove.apply(t.parentNode.classList,classShadeAll)
			})
		});
		/* Filter out blank tiles and random (very quick and dirty) shuffle */
		tiles = Array.prototype.concat.apply([],tiles.map(function(row){
			return row.filter(function(t){
				return t.dataset.range!=="-2"
			})
		})).sort(Math.random);
		/* Shrink tiles */
		var timeout = 500/tiles.length;
		window.setTimeout(function shrink(){
			if( tiles.length ){
				var t = tiles.pop();
				t.classList.add("shrink");
				window.setTimeout(shrink,timeout);
			}
		},timeout);
		/* Set next level */
		window.setTimeout(function(){setLevel(currentLevel+1)},1000);
	}

	function buttonHandler(){
		switch(this.dataset.action){
		case "mainMenu":
			mainMenu();
			break;
		case "packMenu":
			packMenu();
			break;
		case "levelMenu":
			levelMenu(this.dataset.packId);
			break;
		case "setLevel":
			setLevel(this.dataset.level||currentLevel);
			break;
		case "prevLevel":
			setLevel(currentLevel-1);
			break;
		case "nextLevel":
			setLevel(currentLevel+1);
			break;
		case "undoMove":
			undoMove();
			break;
		case "getHint":
			getHint();
			break;
		default:
			console.log(this.dataset.action,"not supported at this time");
		}
	}

	function init(d){
		/* Create stylesheet */
		document.head.appendChild(document.createElement("style"))
		var ss = document.styleSheets[document.styleSheets.length-1];
		data = d;
		data.packs.forEach(function(p){
			var c1 = rgba(p.c1),
				c2 = rgba(p.c2);
			ss.insertRule(".pack"+p.packId+" { background-color: "+c2+"; color: "+c1+"; }",0);
			ss.insertRule(".pack"+p.packId+" .tile { background-color: "+c1+"; color: "+c2+"; }",0);
			ss.insertRule(".pack"+p.packId+" .dot { background-color: "+c1+" !important; }",0);
			ss.insertRule(".pack"+p.packId+" svg * { stroke: "+c1+"; fill: "+c1+"; }",0);
			for( var i = 0; i < NUM_SHADE; i++ ) ss.insertRule(".pack"+p.packId+" .shade"+i+" { background-color: "+rgba(p.c1,(i+1)*0.025)+"; }",0);
		});
		/* Build helper arrays for class names */
		classPackAll = data.packs.map(function(p){return "pack"+p.packId});
		classShadeAll = new Array(NUM_SHADE);
		for( var i = 0; i < NUM_SHADE; i++ ) classShadeAll[i] = "shade"+i;
		/* Attach button click handler */
		for( var i = 0, b = document.getElementsByClassName("button"); i < b.length; i++ ) b[i].onclick = buttonHandler;
		/* Load progress */
		try{
			progress = JSON.parse(localStorage.getItem("dehz-progress"));
		}catch(e){}
		progress = progress || [];
		mainMenu();
	}

	function mainMenu(){
		/* Determine current level (first unfinished level) */
		currentLevel = 0;
		while( currentLevel < progress.length && progress[currentLevel] === currentLevel ){ currentLevel++ }
		/* Apply color scheme */
		DOMTokenList.prototype.remove.apply(document.body.classList,classPackAll);
		document.body.classList.add(classPackAll[data.levels[currentLevel].packId]);
		/* Set level text / progress meter */
		document.getElementById("mainMenuLevel").innerHTML = currentLevel+1;
		var pcnt = progress.length/data.levels.length,
			meter = document.getElementById("progressMeter").attributes.getNamedItem("d");
		meter.value = pcnt < 1 ? "M 50,2.5 A 47.5,47.5 0 "+(+(pcnt>0.5))+",1 "+(50+47.5*Math.sin(2*Math.PI*pcnt))+","+(50-47.5*Math.cos(2*Math.PI*pcnt)) : "M 50,2.5 A 47.5,47.5 0 0,1 50,97.5 M 50,2.5 A 47.5,47.5 0 0,0 50,97.5";
		setView("mainMenu");
	}

	function packMenu(){
		var menu = document.querySelector("#packMenu .content");
		menu.innerHTML = "";
		data.packs.forEach(function(p){
			var div = menu.appendChild(document.createElement("div")),
				s1 = div.appendChild(document.createElement("span")),
				s2 = div.appendChild(document.createElement("span"));
			div.classList.add("tile","button");
			div.dataset.action = "levelMenu";
			div.dataset.packId = p.packId;
			div.onclick = buttonHandler;
			s1.classList.add("floatL");
			s1.innerHTML = "Pack "+(p.packId+1);
			s2.classList.add("floatR");
			s2.innerHTML = progress.filter(function(l){l++;return l>=p.firstLevel&&l<=p.lastLevel}).length+" / "+(p.lastLevel-p.firstLevel+1);
		});
		setView("packMenu");
	}

	function levelMenu(p){
		var menu = document.querySelector("#levelMenu .content");
		menu.innerHTML = "";
		for( var i = data.packs[p].firstLevel-1; i < data.packs[p].lastLevel; i++ ){
			var s = menu.appendChild(document.createElement("span"));
			s.classList.add("tile","button");
			s.dataset.action = "setLevel";
			s.dataset.level = i;
			s.onclick = buttonHandler;
			s.innerHTML = "<span>"+(i+1)+"</span>";
		}
		setView("levelMenu");
	}

	function setLevel(l){
		l = Math.min(data.levels.length-1,l>>>0);
		var level = data.levels[l];
			table = document.getElementById("puzzle-table");
		table.innerHTML = "";
		tiles = [];
		activeTile = undefined;
		history = [];
		for( var r = 0; r < level.rows; r++ ){
			tiles[r] = new Array(level.cols);
			var row = table.insertRow(0);
			for( var c = 0; c < level.cols; c++ ){
				tiles[r][c] = row.insertCell().appendChild(document.createElement("div"));
				tiles[r][c].dataset.range = -2;
				tiles[r][c].dataset.r = r;
				tiles[r][c].dataset.c = c;
				tiles[r][c].parentNode.onclick = clickTile;
				tiles[r][c].parentNode.classList.add("shade"+Math.floor(Math.random()*NUM_SHADE));
			}
		}
		level.tiles.forEach(function(t){
			tiles[t.y][t.x].dataset.range=t.range
			tiles[t.y][t.x].classList.add("tile");
			if( t.range === -1 ) tiles[t.y][t.x].classList.add("goal");
			else                 tiles[t.y][t.x].innerHTML = t.range;
		});
		document.querySelector(".button[data-action='prevLevel']").style.setProperty("visibility",l>0?"visible":"hidden");
		document.querySelector(".button[data-action='nextLevel']").style.setProperty("visibility",l<data.levels.length-1?"visible":"hidden");
		document.querySelector(".button[data-action='getHint']").classList[data.levels[l].solution?"remove":"add"]("disabled");
		currentLevel = l;
		DOMTokenList.prototype.remove.apply(document.body.classList,classPackAll);
		document.body.classList.add(classPackAll[data.levels[currentLevel].packId]);
		document.getElementById("puzzleLevel").innerHTML = currentLevel+1;
		setView("puzzle");
	}

	function undoMove(){
		if( !history.length ) return;
		var m = history.pop(),
			a = m.pop();
		a.t.innerHTML = a.t.dataset.range = a.range;
		m.forEach(function(t){
			t.classList.remove("tile");
			t.dataset.range = -2;
		});
	}
	
	function getHint(){
		var solution = data.levels[currentLevel].solution, i = 0, m1, m2, movesMatch;
		if( !solution ) return;
		if( history.length ){
			do{
				m1 = history[i][history[i].length-1];
				m2 = solution[i];
				movesMatch = m1.x===m2.x && m1.y===m2.y && m1.dx===m2.dx && m1.dy===m2.dy;
				i++;
			}while( i < history.length && i < solution.length && movesMatch );
			if( !movesMatch ){
				i--;
				while( history.length > i ) undoMove();
			};
		}
		var r = solution[i].y,
			c = solution[i].x;
		getRange(r,c,tiles[r][c].dataset.range,solution[i].dx,solution[i].dy).forEach(function(t){t.classList.add("dot","blink")});
		activeTile = {r:r,c:c,range:tiles[r][c].dataset.range};
	}

	return {
		init: init
	};
}();
