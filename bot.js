'use strict';

(function(){
	var botWorker;
	var botReady = false;

	function getBoardMatrix(){
		var width = 10;
		var visibleHeight = 20;
		var board = new Array(visibleHeight);
		var pieceMap = ['I','J','L','O','S','T','Z'];
		for(var vy=0; vy<visibleHeight; vy++){
			var y = vy + 2; // skip hidden rows 0..1
			var row = new Array(width);
			for(var x=0;x<width;x++){
				var cell = (stack.grid && stack.grid[x] && stack.grid[x][y]);
				if (cell) {
					row[x] = (cell >= 1 && cell <= 7) ? pieceMap[cell - 1] : 'Z';
				} else {
					row[x] = null;
				}
			}
			board[vy] = row;
		}
		return board;
	}

	function mapIndexToTBPPiece(index){
		return ['I','J','L','O','S','T','Z'][index];
	}

	function mapOrientationToRotation(orientation) {
		switch (orientation) {
			case 'north': return 0;
			case 'east': return 1;
			case 'south': return 2;
			case 'west': return 3;
			default: return 0;
		}
	}

	function getPieceCenter(tetro) {
		var mino_xs = [];
		var mino_ys = [];
		for (var y = 0; y < tetro.length; y++) {
			for (var x = 0; x < tetro[y].length; x++) {
				if (tetro[y][x]) {
					mino_xs.push(x);
					mino_ys.push(y);
				}
			}
		}
		var avg_x = mino_xs.reduce((a, b) => a + b, 0) / mino_xs.length;
		var avg_y = mino_ys.reduce((a, b) => a + b, 0) / mino_ys.length;
		return { x: avg_x, y: avg_y };
	}

	function currentStateToTBPStartMessage(){
		var queue = [];
		if (piece) {
			queue.push(mapIndexToTBPPiece(piece.index));
		}
		if (preview && preview.grabBag) {
			queue.push.apply(queue, preview.grabBag.slice(0, 5).map(mapIndexToTBPPiece));
		}
		var holdPiece = (typeof hold !== 'undefined' && hold.piece !== void 0) ? mapIndexToTBPPiece(hold.piece) : null;
		return {
			type: 'start',
			board: getBoardMatrix(),
			hold: holdPiece,
			queue: queue,
			combo: 0,
			back_to_back: false,
		};
	}

	function executeBotInstruction(move){
		if(!piece || gameState!==0 || !move) return;

		var location = move.location;
		var targetPiece = location.type;

		if(targetPiece && mapIndexToTBPPiece(piece.index) !== targetPiece){
			piece.hold();
		}

		var targetRotation = mapOrientationToRotation(location.orientation);
		var currentRotation = piece.pos.mod(4);
		var rotationDiff = (targetRotation - currentRotation + 4).mod(4);
		if (rotationDiff === 3) {
			piece.rotate(-1);
		} else {
			for (var i = 0; i < rotationDiff; i++) {
				piece.rotate(1);
			}
		}

		var localCenter = getPieceCenter(piece.tetro);

		var targetX = location.x - localCenter.x;

		var tetris_center_y = 21 - location.y;
		var targetY = tetris_center_y - localCenter.y;

		var currentX = Math.round(piece.x);
		var dx = targetX - currentX;
		var dir = dx > 0 ? 1 : -1;
		for(var i=0; i<Math.abs(dx); i++){
			piece.shift(dir);
		}

		piece.y = targetY;

		stack.addPiece(piece.tetro);
		setTimeout(function() {
			piece.new(preview.next());
		}, 0);
	}

	function runOneStep(){
		if (!botReady || gameState !== 0) {
			return;
		}
		try {
			botReady = false;
			var startMessage = currentStateToTBPStartMessage();
			botWorker.postMessage(startMessage);
			botWorker.postMessage({ type: 'suggest' });
		} catch (e) {
			botReady = true;
		}
	}

	try {
		botWorker = new Worker('misamino/misaImport.js');

		botWorker.onmessage = function(e) {
			var msg = e.data;
			switch(msg.type) {
				case 'ready':
				case 'info':
					botReady = true;
					break;
				case 'suggestion':
					if (msg.moves && msg.moves.length > 0) {
						executeBotInstruction(msg.moves[0]);
					}
					botReady = true;
					break;
				case 'error':
					botReady = true;
					break;
				default:
					//
			}
		};

		botWorker.onerror = function(e) {
			botReady = true;
		};

	} catch (e) {
		// Worker initialization failed
	}

	window.botIntegration = {
		runOneStep: runOneStep
	};
})();
