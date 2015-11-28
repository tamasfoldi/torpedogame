/// <reference path="jquery.d.ts" />
/// <reference path='jqueryui.d.ts' />
/// <reference path="typings/tsd.d.ts" />

class Cell {
    shipIndex:number;
    hasHit:boolean;
    element:HTMLElement;

    constructor(public row:number, public column:number) {
        this.element = $("<div class='cell notBombed'></div>")[0];
    }

    // Parse a cell location of the format "row,column"
    static parseCellLocation(pos:string) {
        var indices:string[] = pos.split(",");
        return {'row': parseInt(indices[0]), 'column': parseInt(indices[1])};
    }

    // Return the cell location of the format "row,column"
    cellLocation() {
        return "" + this.row + "," + this.column;
    }
}

class Ship {
    column = 0;
    row = 0;
    isVertical = true;
    hits = 0;
    element:HTMLElement;

    constructor(public size:number) {
        this.element = $("<div class='ship'></div>")[0];
    }

    updatePosition(row:number, column:number, vertical:boolean) {
        this.row = row;
        this.column = column;
        this.isVertical = vertical;
        this.updateLayout();
    }

    updateLayout() {
        var width = "9.9%";
        var height = "" + (this.size * 9.9) + "%";
        this.element.style.left = "" + (this.column * 10) + "%";
        this.element.style.top = "" + (this.row * 10) + "%";
        this.element.style.width = this.isVertical ? width : height;
        this.element.style.height = this.isVertical ? height : width;
    }

    flipShip() {
        this.isVertical = !this.isVertical;
        if (this.isVertical) {
            if (this.row + this.size > 10) {
                this.row = 10 - this.size;
            }
        } else {
            if (this.column + this.size > 10) {
                this.column = 10 - this.size;
            }
        }
        this.updateLayout();
    }

    getCellsCovered() {
        var cells:string[] = [];
        var row = this.row;
        var col = this.column;
        for (var i = 0; i < this.size; i++) {
            cells.push(row.toString() + "," + col.toString());
            if (this.isVertical) {
                row++;
            } else {
                col++;
            }
        }
        return cells;
    }

    isSunk() {
        return this.hits === this.size;
    }
}

abstract class Board {
    ships:Ship[];
    cells:Cell[][];             // Indexed by [rows][columns]
    playerTurn = false;          // Set to true when player can move
    onEvent:Function;           // Callback function when an action on the board occurs

    constructor(public element:HTMLElement) {
        this.cells = [];
        this.ships = [];
        var cell:Cell = null;

        // Create the cells for the board
        for (var row = 0; row < 10; row++) {
            this.cells[row] = [];
            for (var column = 0; column < 10; column++) {
                cell = new Cell(row, column);
                this.cells[row][column] = cell;
                element.appendChild(cell.element);
                $(cell.element).data("cellLocation", cell.cellLocation());
            }
        }
    }

    abstract onCellClick(evt:JQueryEventObject);

    static getRandomPosition() {
        return {
            "row": Math.floor(Math.random() * 10),
            "column": Math.floor(Math.random() * 10),
            "vertical": (Math.floor(Math.random() * 2) === 1)
        }
    }

    randomize() {
        var shipCount = this.ships.length;
        do {
            for (var shipIndex = 0; shipIndex < shipCount; shipIndex++) {
                var pos = Board.getRandomPosition();
                this.ships[shipIndex].updatePosition(pos.row, pos.column, pos.vertical);
            }
        } while (!this.boardIsValid());
    }

    boardIsValid() {
        // Check if any ships overlap my checking their cells for duplicates.
        // Do this by putting into a flat array, sorting, and seeing if any adjacent cells are equal
        var allCells:string[] = [];
        for (var i = 0; i < this.ships.length; i++) {
            allCells = allCells.concat(this.ships[i].getCellsCovered());
        }
        allCells.sort();
        var dups = allCells.some(function (val, idx, arr) {
            return val === arr[idx + 1];
        });

        // See if any ship cells are off the board
        var outOfRange = allCells.some(function (val:string) {
            var pos = Cell.parseCellLocation(val);
            return !(pos.column >= 0 && pos.column <= 9 && pos.row >= 0 && pos.row <= 9);
        });
        if (dups || outOfRange) {
            return false;
        } else {
            this.updateCellData();
            return true;
        }
    }

    private updateCellData() {
        for (var i = 0; i < 100; i++) {
            var x = this.cells[Math.floor(i / 10)][i % 10];
            x.hasHit = false;
            x.shipIndex = -1;
        }

        for (var index = 0; index < this.ships.length; index++) {
            var ship = this.ships[index];
            ship.hits = 0;
            var cells = ship.getCellsCovered();
            for (var cell = 0; cell < cells.length; cell++) {
                var cellPos = Cell.parseCellLocation(cells[cell]);
                var targetCell = this.cells[cellPos.row][cellPos.column];
                targetCell.shipIndex = index;
            }
        }

        $(this.element).children(".cell").removeClass("cellHit cellMiss").addClass("notBombed");
    }
}

class MyBoard extends Board {
    //shipSizes = [5, 4, 4, 3, 3, 3, 2, 2, 2, 2];
    shipSizes = [2];
    private positioningEnabled:boolean;    // Set to true when the player can position the ships

    constructor(public element:HTMLElement) {
        super(element);
        this.positioningEnabled = true;

        for (var row = 0; row < this.cells.length; row++) {
            for (var column = 0; column < this.cells[0].length; column++) {
                var cell = this.cells[row][column];
                $(cell.element).droppable({
                    disabled: false,
                    drop: (event, ui) => {
                        var shipElement = <HTMLElement>ui.draggable[0];
                        var shipIndex:number = $(shipElement).data("shipIndex");
                        var ship = this.ships[shipIndex];
                        var shipX = Math.round(shipElement.offsetLeft / cell.element.offsetWidth);
                        var shipY = Math.round(shipElement.offsetTop / cell.element.offsetHeight);
                        ship.updatePosition(shipY, shipX, ship.isVertical);
                    }
                });
            }
        }

        var referenceCell = $("#playerBoard .cell").first();
        for (var i = 0; i < this.shipSizes.length; i++) {
            var ship = new Ship(this.shipSizes[i]);
            this.ships[i] = ship;
            ship.updatePosition(i, 0, false);
            // Show the ships for positioning.
            this.element.appendChild(ship.element);
            ship.updateLayout();
            $(ship.element).data("shipIndex", i).draggable({
                disabled: false,
                containment: 'parent',
                // Reduce size slightly to avoid overlap issues blocking the last cell
                grid: [referenceCell.width() * 0.99 + 2, referenceCell.height() * 0.99 + 2],
                cursor: 'crosshair'
            }).click((evt:JQueryEventObject) => {
                if (this.positioningEnabled) {
                    var shipIndex:number = $(evt.target).data("shipIndex");
                    this.ships[shipIndex].flipShip();
                }
            });

        }

        $(window).resize((evt) => {
            $(this.element).children(".ship").draggable("option", "grid", [referenceCell.width() * 0.99 + 2, referenceCell.height() * 0.99 + 2]);
        });
    }

    onCellClick(evt:JQueryEventObject) {
        var x = <HTMLElement>evt.target;
        if ($(x).hasClass("cell") === false) {
            return;
        }
        if (!this.playerTurn) {
            this.onEvent.call(this, 'click');
        }
        if (this.playerTurn) {       // May be updated by prior onEvent call, so check again
            this.bombCell(x);
        }
    }

    bombCell(cellElem:HTMLElement) {
        var cellPos = Cell.parseCellLocation($(cellElem).data("cellLocation"));
        var cell = this.cells[cellPos.row][cellPos.column];
        if (cell.hasHit) {
            return;  // Already been clicked on
        }
        cell.hasHit = true;
        $(cellElem).removeClass("notBombed");

        var response:any = {type: "bombResponse", cellPos: cellPos, hit: false};
        if (cell.shipIndex >= 0) { // Has a ship
            $(cellElem).addClass("cellHit");
            var ship = this.ships[cell.shipIndex];
            ship.hits++;
            response.hit = true;
            if (ship.isSunk()) {
                this.element.appendChild(ship.element);
                ship.updateLayout();
                response.ship = {row: ship.row, column: ship.column, isVertical: ship.isVertical, size: ship.size};
                if (this.allShipsSunk()) {
                    response.allSunk = true;
                    this.onEvent.call(this, 'allSunk', response);
                }
                else {
                    this.onEvent.call(this, 'shipSunk', response);
                }
            }
            else {
                this.onEvent.call(this, 'hit', response);
            }
        }
        else {
            $(cellElem).addClass("cellMiss");
            this.onEvent.call(this, 'playerMissed', response);
        }
    }

    set dragAndDropEnabled(val:boolean) {
        var cells = $(this.element).children(".cell");
        var ships = $(this.element).children(".ship");

        this.positioningEnabled = val;
        ships.draggable("option", "disabled", !val);
        cells.droppable("option", "disabled", !val);
    }

    private allShipsSunk() {
        return this.ships.every(function (val) {
            return val.isSunk();
        });
    }
}

class EnemyBoard extends Board {
    constructor(element:HTMLElement) {
        super(element);

        // enemy board, this is where the player clicks to bomb
        $(element).click((evt:JQueryEventObject) => this.onCellClick(evt));
    }


onCellClick(evt:JQueryEventObject) {
    var x = <HTMLElement>evt.target;
    if ($(x).hasClass("cell") === false) {
        return;
    }
    if (!this.playerTurn) {
        this.onEvent.call(this, 'click');
    }
    if (this.playerTurn) {       // May be updated by prior onEvent call, so check again
        var cellPos = Cell.parseCellLocation($(x).data("cellLocation"));
        //console.log("Enemyboard (", cellPos.row, ",", cellPos.column, ") bombed.");
        this.onEvent.call(this, 'bombCell', {type: 'bombCell', cellPos});
    }
}

updateBoard(msg)
{
    var cell = this.cells[msg.cellPos.row][msg.cellPos.column];
    $(cell.element).removeClass("notBombed");
    if (msg.hit) {
        $(cell.element).addClass("cellHit");

    } else {
        $(cell.element).addClass("cellMiss");
    }
    if (msg.hasOwnProperty('ship')) {
        var ship = new Ship(msg.ship.size);
        ship.updatePosition(msg.ship.row, msg.ship.column, msg.ship.isVertical);
        this.ships.push(ship);
        this.element.appendChild(ship.element);
    }
}
}

class Game {
    static gameState = {begin: 0, enemyReady: 1, iAmReady: 2, enemyTurn: 3, myTurn: 4, finished: 5};
    static msgs = {
        gameStart: "Drag your ships to the desired location on your board (on the right), then bomb a square on the left board to start the game!",
        invalidPositions: "All ships must be in valid positions before the game can begin.",
        waitForStart: "Wait until your enemy places all his ships.",
        wait: "Wait your turn!",
        gameOn: "Game on!",
        yourTurn: "Your turn, bomb now!",
        hit: "Good hit!",
        miss: "Miss.",
        shipSunk: "You sunk a ship!",
        lostShip: "You lost a ship!",
        lostGame: "You lost this time.",
        allSunk: "Congratulations!  You won!"
    };

    state = Game.gameState.begin;
    myBoard:MyBoard;
    enemyBoard:EnemyBoard;
    startTime:number;
    duration:number;


    constructor(private connection:PeerJs.DataConnection) {
        $("#boards").append("<div id='enemyBoard' class='board'>a</div><div id='playerBoard' class='board'>b</div>");
        this.updateStatus(Game.msgs.gameStart);
        this.startTime = Date.now();
        this.myBoard = new MyBoard($("#playerBoard")[0]);
        this.enemyBoard = new EnemyBoard($("#enemyBoard")[0]);
        this.myBoard.randomize();
        this.myBoard.dragAndDropEnabled = true;
        this.enemyBoard.onEvent = (evt:string, evtData:any) => {
            switch (evt) {
                case 'click': // The user has click outside a turn.  Action depends on current state
                    switch (this.state) {
                        case Game.gameState.begin:
                            this.readyToStartGame();
                            break;
                        case Game.gameState.enemyReady:
                            this.readyToStartGame();
                            break;
                        case Game.gameState.iAmReady:
                            this.updateStatus(Game.msgs.waitForStart);
                            break;
                        case Game.gameState.enemyTurn:  // Not their turn yet.  Ask to wait.
                            this.updateStatus(Game.msgs.wait);
                            break;
                        case Game.gameState.finished:
                            break;
                    }
                    break;
                case 'bombCell':
                    this.connection.send(evtData);
                    break;
            }
        };
        this.myBoard.onEvent = (evt:string, evtData:any) => {
            switch (evt) {
                case 'playerMissed':
                    this.connection.send(evtData);
                    break;
                case 'hit':
                    this.connection.send(evtData);
                    break;
                case 'shipSunk':
                    this.connection.send(evtData);
                    this.updateStatus(Game.msgs.lostShip);
                    break;
                case 'allSunk':
                    this.updateStatus(Game.msgs.lostGame);
                    this.state = Game.gameState.finished;
                    this.duration = Date.now() - this.startTime;
                    this.connection.send(evtData);
                    break;
            }
        };
    }

    private readyToStartGame() {
        if (this.myBoard.boardIsValid()) {
            //console.log(this.myBoard.cells);
            this.myBoard.dragAndDropEnabled = false;
            this.connection.send({type: "readyToPlay"});
            if (this.state == Game.gameState.begin) {
                this.state = Game.gameState.iAmReady;
                this.updateStatus(Game.msgs.waitForStart);
            } else if (this.state = Game.gameState.enemyReady) {
                this.passToken();
                this.updateStatus(Game.msgs.wait);
            }
        }
        else {
            this.updateStatus(Game.msgs.invalidPositions);
        }
    }

    private updateStatus(msg:string) {
        $("#status").slideUp('fast', function () {  // Slide out the old text
            $(this).text(msg).slideDown('fast');  // Then slide in the new text
        });
    }

    public getToken() {
        this.myBoard.playerTurn = false;
        this.enemyBoard.playerTurn = true;
        this.state = Game.gameState.myTurn;
        this.updateStatus(Game.msgs.yourTurn);
        //console.log("Got token.");
    }

    public passToken() {
        this.myBoard.playerTurn = true;
        this.enemyBoard.playerTurn = false;
        this.state = Game.gameState.enemyTurn;
        //this.updateStatus(Game.msgs.wait);
        this.connection.send({type: "passToken"});
        //console.log("Token passed.");
    }

    public incomingBomb(cellPos) {
        var cell = this.myBoard.cells[cellPos.row][cellPos.column];
        this.myBoard.bombCell(cell.element);
    }


}

$(document).ready(function () {
    var game;
    var peer = new Peer({key: 'okvgv06ocyjh5mi', debug: 3});
    var conn;

    peer.on('open', function (id) {
        $('#info').append(" My Id= " + id);
    });

    peer.on('connection', connect);

    function connect(c) {
        if (conn == null || !conn.open) {
            conn = c;
            //$('#messages').empty().append('Connected to: ' + conn.peer);
            game = new Game(conn);

            conn.on('data', function (data) {
                $('#messages').append('<br>' + conn.peer.substr(0, 5) + ': ' + JSON.stringify(data));
                handleMessage(data);
            });
            conn.on('close', function (err) {
                $('#messages').append('<br>' + conn.peer.substr(0, 5) + ' has left.');
            });
            conn.on('error', function (err) {
                alert(err);
            });
        }
        else {
            c.close();
        }
    }


    // Conect to a peer
    $('#connect').click(function () {
        var c = peer.connect($('#enemyid').val());
        c.on('open', function () {
            connect(c);
        });
        c.on('error', function (err) {
            alert(err)
        });
    });

/*    // Send a Hi message
    $('#sendhi').click(function () {
        var msg = "Hi!";
        conn.send(msg);
        $('#messages').append('<br>You: ' + JSON.stringify(msg));
    });*/

    // Send a chat message
    $('#sendmsg').click(function () {
        var msg = $('#message').val();
        conn.send(msg);
        $('#messages').append('<br>You: ' + JSON.stringify(msg));
    });


    function handleMessage(message) {
        var msg = message;
        if (!msg || !msg.hasOwnProperty('type')) return;
        switch (msg.type) {
            case "readyToPlay":
                //ha befejezte a másik fél a hajói lerakását, akkor küld egy ilyet.
                // ha én már kész vagyok
                if (game.state == Game.gameState.iAmReady) {
                    game.updateStatus(Game.msgs.gameOn);
                }
                else if (game.state == Game.gameState.begin) {
                    game.state = Game.gameState.enemyReady;
                }
                break;
            case "passToken":
                //megkapjuk a tokent, most már mi jövünk.
                game.getToken();
                break;
            case "bombCell":
                //megbombázzák egy cellánkat, válaszolni kell rá.
                if (game.state == Game.gameState.enemyTurn) {
                    game.incomingBomb(msg.cellPos);
                }
                break;
            case "bombResponse":
                //ezt kapjuk ha lőttünk, válaszul
                game.enemyBoard.updateBoard(msg);
                if (msg.hit) {
                    game.updateStatus(Game.msgs.hit);
                    if (msg.hasOwnProperty("ship")) {
                        game.updateStatus(Game.msgs.shipSunk);
                    }
                }
                else {
                    game.updateStatus(Game.msgs.miss);
                }
                if (msg.hasOwnProperty("allSunk")) {
                    if (msg.allSunk) {
                        //ha minden hajót elsüllyesztettünk, ezt kapjuk
                        //ennek megfelelően ezt jeleznünk kell a szervernek, és bontanunk a kapcsolatot.
                        game.state = Game.gameState.finished;
                        game.enemyBoard.playerTurn = false;
                        game.duration = Date.now() - game.startTime;
                        //console.log("Game duration:", game.duration / 1000, " sec");
                        game.updateStatus(Game.msgs.allSunk);
                    }
                }
                if (game.state != Game.gameState.finished) {
                    game.passToken();
                }
                break;
        }
    }
});

