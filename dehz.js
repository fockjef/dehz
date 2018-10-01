var dehz = function(){
	var NUM_SHADE = 10,
		tiles, activeTile, history = [];

	function rgba(color,alpha){
		return "rgba("+color.r+","+color.g+","+color.b+","+(alpha||color.a/255)+")";
	}

	function clickTile(r,c){
		var isDot = tiles[r][c].classList.contains("dot");
		tiles.forEach(function(row){row.forEach(function(t){t.classList.remove("dot")})});
		if( tiles[r][c].dataset.range > 0 ){
			[].concat(
				getRange(r,c,tiles[r][c].dataset.range, 1, 0),
				getRange(r,c,tiles[r][c].dataset.range,-1, 0),
				getRange(r,c,tiles[r][c].dataset.range, 0, 1),
				getRange(r,c,tiles[r][c].dataset.range, 0,-1)
			).forEach(function(t){t.classList.add("dot")});
			activeTile = {r:r,c:c,range:tiles[r][c].dataset.range};
			return;
		}
		else if( isDot ){
			if( tiles[r][c].dataset.range === "-1" ){
				this.progress.completedLevels.push(this.progress.currentLevel);
				this.progress.currentLevel++;
				localStorage.setItem("dehz-progress",JSON.stringify(this.progress));
				this.setLevel(this.progress.currentLevel);
				return console.log("Level Complete!");
			}
			else{
				getRange(activeTile.r,activeTile.c,activeTile.range,Math.sign(c-activeTile.c),Math.sign(r-activeTile.r),"tile").forEach(function(t){
					t.classList.add("tile");
					t.dataset.range = 0;
				});
				tiles[activeTile.r][activeTile.c].innerHTML = "";
				tiles[activeTile.r][activeTile.c].dataset.range = 0;
			}
		}
		activeTile = undefined;
	}

	function getRange(r,c,range,dx,dy){
		var t = [];
		c += dx;
		r += dy;
		while( range && c >= 0 && c < tiles[0].length && r >= 0 && r < tiles.length ){
			if( tiles[r][c].dataset.range < 0 ){
				t.push(tiles[r][c]);
				range--;
			}
			c += dx;
			r += dy;
		}
		return t;
	}

	return {
		progress: JSON.parse(localStorage.getItem("dehz-progress")) || {
			currentLevel: 0,
			completedLevels: []
		},
		init: function(data,id){
			this.data = data;
			this.root = document.getElementById(id) || document.body;
			/* Create stylesheet */
			document.head.appendChild(document.createElement("style"))
			var ss = document.styleSheets[document.styleSheets.length-1];
			this.data.packs.forEach(function(p){
				var c1 = rgba(p.c1),
					c2 = rgba(p.c2);
				ss.insertRule(".pack"+p.packId+" { background-color: "+c2+"; color: "+c1+"; }");
				ss.insertRule(".pack"+p.packId+" .tile { background-color: "+c1+"; color: "+c2+"; }");
				ss.insertRule(".pack"+p.packId+" .dot { background-color: "+c1+" !important; }");
				for( var i = 0; i < NUM_SHADE; i++ ) ss.insertRule(".pack"+p.packId+" .shade"+i+" { background-color: "+rgba(p.c1,(i+1)*0.025)+"; }");
			});
			this.setLevel(this.progress.currentLevel);
		},
		menuMain: function(){
			return undefined;
		},
		menuLevels: function(){
			return undefined;
		},
		setLevel: function(l){
			this.root.innerHTML = "";
			var level = this.data.levels[l],
				head = this.root.appendChild(document.createElement("div")),
				table = this.root.appendChild(document.createElement("table")),
				foot = this.root.appendChild(document.createElement("div"));
			head.id = "level-head";
			table.id = "level-content";
			foot.id = "level-foot";
			tiles = [];
			for( var r = 0; r < level.rows; r++ ){
				tiles[r] = new Array(level.cols);
				var row = table.insertRow(0);
				for( var c = 0; c < level.cols; c++ ){
					tiles[r][c] = row.insertCell().appendChild(document.createElement("div"));
					tiles[r][c].dataset.range = -2;
					tiles[r][c].parentNode.onclick = function(r,c,self){return function(){clickTile.call(self,r,c)}}(r,c,this);
					tiles[r][c].parentNode.classList.add("shade"+Math.floor(Math.random()*NUM_SHADE));
				}
			}
			level.tiles.forEach(function(t){
				tiles[t.y][t.x].dataset.range=t.range
				tiles[t.y][t.x].classList.add("tile");
				if( t.range === -1 ) tiles[t.y][t.x].classList.add("goal");
				else                 tiles[t.y][t.x].innerHTML = t.range;
			});
			head.appendChild(document.createElement("span"));
			head.appendChild(document.createElement("span").appendChild(document.createTextNode(l)).parentNode);
			head.appendChild(document.createElement("span"));
			DOMTokenList.prototype.remove.apply(this.root.classList,this.data.packs.map(function(p){return "pack"+p.packId}));
			this.progress.currentLevel = l;
			this.root.classList.add("pack"+this.data.levels[this.progress.currentLevel].packId);
		},
		resetLevel: function(){
			this.setLevel(this.progress.currentLevel);
		},
		undoMove: function(){
			return undefined;
		}
	}
}();
