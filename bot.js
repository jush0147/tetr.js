'use strict';

(function(){
	var botWorker;
	var botReady = false;

	function getBoardMatrix(){
		var width = 10;
		var height = 40;
		var visible_tetr_js_rows = 20;
		var board = new Array(height);

		var pieceMap = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
		for (var i = 0; i < visible_tetr_js_rows; i++) {
			var tetr_js_y = i + 2; // tetr.js rows 2-21
			var tbp_y = 19 - i; // TBP rows 19-0

			var row = new Array(width);
			for (var x = 0; x < width; x++) {
				var cell = (stack.grid && stack.grid[x] && stack.grid[x][tetr_js_y]);
				if (cell) {
					if (cell >= 1 && cell <= 7) {
						row[x] = pieceMap[cell - 1];
					} else { // Garbage blocks (value 8)
						row[x] = 'G';
					}
				} else {
					row[x] = null;
				}
			}
			board[tbp_y] = row;
		}

		for (var y = 20; y < height; y++) {
			board[y] = new Array(width).fill(null);
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
