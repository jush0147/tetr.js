'use strict';

(function(){
	function getBoardMatrix(){
		// stack.grid is [x][y] with height 22 (top 2 hidden). TBP expects 20 visible rows.
		var width = 10;
		var visibleHeight = 20;
		var board = new Array(visibleHeight);
		for(var vy=0; vy<visibleHeight; vy++){
			var y = vy + 2; // skip hidden rows 0..1
			var row = new Array(width);
			for(var x=0;x<width;x++){
				row[x] = (stack.grid && stack.grid[x] && stack.grid[x][y]) ? 1 : 0;
			}
			board[vy] = row;
		}
		return board;
	}

	function mapIndexToTBPPiece(index){
		// TBP uses letters I,J,L,O,S,T,Z
		return ['I','J','L','O','S','T','Z'][index];
	}

	function currentStateToTBP(){
		var bagPreview = (preview && preview.grabBag) ? preview.grabBag.slice() : [];
		var queue = bagPreview.slice(0, 5).map(mapIndexToTBPPiece);
		var holdPiece = (typeof hold !== 'undefined' && hold.piece !== void 0) ? mapIndexToTBPPiece(hold.piece) : null;
		var active = piece ? {
			piece: mapIndexToTBPPiece(piece.index),
			x: Math.floor(piece.x),
			// Convert game y (0 at hidden row 0) to TBP visible y (0 is top visible row)
			y: Math.floor(piece.y) - 2,
			rotation: (piece.pos||0) % 4
		} : null;
		return {
			board: getBoardMatrix(),
			active: active,
			queue: queue,
			hold: holdPiece
		};
	}

	function executeBotInstruction(instr){
		// instr: { piece, x, y, rotation }
		if(!piece || gameState!==0) return;
		var targetPiece = instr.piece;
		if(targetPiece && mapIndexToTBPPiece(piece.index) !== targetPiece){
			piece.hold();
		}
		// rotate to rotation
		var cur = piece.pos % 4;
		var target = (instr.rotation||0)%4;
		var right = ((target - cur + 4) % 4);
		var left = (4 - right) % 4;
		var dir = right <= left ? 1 : -1;
		var steps = Math.min(right, left);
		for(var i=0;i<steps;i++) piece.rotate(dir);
		// move horizontally to x
		var tx = instr.x|0;
		while(Math.floor(piece.x) < tx){ piece.shift(1); }
		while(Math.floor(piece.x) > tx){ piece.shift(-1); }
		// drop to y or hard drop; TBP usually gives final lock position
		piece.hardDrop();
	}

	function runOneStep(){
		var tbp = currentStateToTBP();
		if(!window.MisaMinoTBP || typeof window.MisaMinoTBP.compute !== 'function'){
			console.warn('MisaMinoTBP not loaded; TBP state:', tbp);
			return;
		}
		try{
			var instr = window.MisaMinoTBP.compute(tbp);
			executeBotInstruction(instr);
		}catch(e){
			console.error('Bot error', e);
		}
	}

	window.botIntegration = {
		currentStateToTBP: currentStateToTBP,
		runOneStep: runOneStep
	};
})();

