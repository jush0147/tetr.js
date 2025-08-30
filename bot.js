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
					// cell value is index + 1. index maps to piece.
					// garbage blocks are 8.
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

	function currentStateToTBPStartMessage(){
		// The queue should include the current piece.
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
			combo: 0, // Assuming no combo tracking
			back_to_back: false, // Assuming no b2b tracking
		};
	}

	function executeBotInstruction(move){
		if(!piece || gameState!==0 || !move) return;

		var location = move.location;
		var targetPiece = location.type;

		// Hold if necessary
		if(targetPiece && mapIndexToTBPPiece(piece.index) !== targetPiece){
			piece.hold();
			// After hold, the piece object is updated to the new piece.
			// We need to wait for the next step to control the new piece.
			// For now, we assume the bot gives a move for the current piece or the piece from hold.
		}

		// Rotate
		var targetRotation = mapOrientationToRotation(location.orientation);
		var currentRotation = piece.pos.mod(4);
		var rotationDiff = (targetRotation - currentRotation + 4).mod(4);
		if (rotationDiff === 3) { // prefer counter-clockwise
			piece.rotate(-1);
		} else {
			for (var i = 0; i < rotationDiff; i++) {
				piece.rotate(1);
			}
		}

		// Move
		// We need to find the target X for the piece's top-left corner.
		// The bot gives the final X of the piece's center. This is tricky.
		// The `executeBotInstruction` in the original bot.js had a simple loop.
		// Let's try to replicate that. The bot gives the column of the leftmost part of the piece.
		// Let's assume the 'x' from the bot is the final column of the piece's top-left corner.
		var targetX = location.x;

		// The piece's `x` is the column of its bounding box's left edge.
		// The bot's `x` in the location object is the column of the top-left-most block of the piece.
		// This requires a more complex calculation based on the piece's shape and rotation.
		// For simplicity, let's assume the bot's 'x' is the target for piece.x.
		// This might be wrong.

		// A better approach is to check the piece's minos.
		// The final X position of the piece object should be such that the leftmost mino of the piece is at location.x
		var pieceXOffset = 0;
		for (var y = 0; y < piece.tetro.length; y++) {
			for (var x = 0; x < piece.tetro[y].length; x++) {
				if (piece.tetro[y][x]) {
					pieceXOffset = x;
					break;
				}
			}
			if (pieceXOffset > 0) break;
		}
		targetX = location.x - pieceXOffset;


		var currentX = Math.round(piece.x);
		var dx = targetX - currentX;
		var dir = dx > 0 ? 1 : -1;
		for(var i=0; i<Math.abs(dx); i++){
			piece.shift(dir);
		}

		// Hard drop
		piece.hardDrop();
	}

	function runOneStep(){
		if (!botReady || gameState !== 0) {
			return;
		}
		botReady = false;

		var startMessage = currentStateToTBPStartMessage();
		botWorker.postMessage(startMessage);
		botWorker.postMessage({ type: 'suggest' });
	}

	try {
		botWorker = new Worker('misamino/misaImport.js');

		botWorker.onmessage = function(e) {
			var msg = e.data;
			switch(msg.type) {
				case 'ready':
					botReady = true;
					break;
				case 'suggestion':
					if (msg.moves && msg.moves.length > 0) {
						executeBotInstruction(msg.moves[0]);
					}
					// The bot is ready for the next move after making a suggestion.
					botReady = true;
					break;
				case 'error':
					console.error('MisaMinoTBP Error:', msg.error);
					botReady = true; // Allow trying again
					break;
				default:
					console.log('MisaMinoTBP message:', msg);
			}
		};

		botWorker.onerror = function(e) {
			console.error('Error in bot worker:', e);
			botReady = true; // Allow trying again
		};

	} catch (e) {
		console.error('Failed to initialize bot worker:', e);
	}

	window.botIntegration = {
		runOneStep: runOneStep
	};
})();
