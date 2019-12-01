import * as net from "net";
import {ClientboundPacket, ConnectionState, ServerboundPacket} from "./packet/Packet";
import ServerboundHandshakePacket from "./packet/ServerboundHandshakePacket";
import MinecraftVersions from "./MinecraftVersions";
// @ts-ignore - has missing type definitions.
import uuid from "uuid-by-string";

export default class MinecraftServer {
    
    static readonly CURRENT_PROTOCOL_VERSION: number = 340;

    host: string;
    port: number;
    motd: string;
    
    private server: net.Server;
    
    constructor(port: number, host: string = '0.0.0.0', motd: string = "2long2wait") {
        this.port = port;
        this.host = host;
        this.motd = motd;
    }
    
    async start() : Promise<void> {
        await new Promise((resolve, reject) => {
            this.server = net.createServer(this.handleConnection).on('error', reject);
            this.server.listen(this.port, this.host, resolve);
        });
    }
    
    async stop() : Promise<void> {
        await new Promise((resolve, reject) => {
            this.server.close(resolve);
        });
    }
    
    setMOTD (motd: string) : void {
        this.motd = motd;
    }
    
    private handleConnection (socket: net.Socket) {
        console.log(`Connection from ${socket.remoteAddress}`);
        let connectionState = ConnectionState.HANDSHAKE;
        let clientState = new ClientState();
        let clientKeepAliveInterval = setInterval(() => {
            if(connectionState == ConnectionState.PLAY && clientState.waitingInQueue){
                clientState.lastKeepAlive.id = BigInt(Math.floor(Math.random() * 100));
                clientState.lastKeepAlive.time = new Date().getTime();
                
                let clientboundPlayKeepAlivePacket = new ClientboundPacket(ConnectionState.PLAY, 0x1F);
                clientboundPlayKeepAlivePacket.writeLong(clientState.lastKeepAlive.id);
                socket.write(clientboundPlayKeepAlivePacket.pack());
            }
        }, 20000);
        
        socket.on('end', () => {
            clearInterval(clientKeepAliveInterval);
            console.log("Connection closed.");
        });
        
        socket.on('data', (data: Buffer | String) => {
            if(!(data instanceof Buffer)) return;
            
            let serverboundPacket : ServerboundPacket = new ServerboundPacket(data, connectionState);
            
            switch(connectionState){
                case ConnectionState.HANDSHAKE:
                    switch(serverboundPacket.id){
                        // Handshake
                        case 0x00:
                            let serverboundHandshakePacket = ServerboundHandshakePacket.contextualize(serverboundPacket);
                            if(serverboundHandshakePacket.protocolVersion !== MinecraftServer.CURRENT_PROTOCOL_VERSION){
                                console.log(`Connection from client with invalid version. (Server version = ${MinecraftVersions.getVersionString(MinecraftServer.CURRENT_PROTOCOL_VERSION)}; Client version = ${MinecraftVersions.getVersionString(serverboundHandshakePacket.protocolVersion)})`);
                            }
                            
                            clientState.protocolVersion = serverboundHandshakePacket.protocolVersion;
                            connectionState = serverboundHandshakePacket.nextConnectionState;
                            break;
                        
                        case 0xFE:
                            break;
                    }
                    
                    break;
                    
                case ConnectionState.STATUS:
                    switch(serverboundPacket.id){
                        case 0x00:
                            let clientboundStatusResponsePacket = new ClientboundPacket(ConnectionState.STATUS, 0x00);
                            clientboundStatusResponsePacket.writeJSON({
                                version: {
                                    name: MinecraftVersions.getVersionString(MinecraftServer.CURRENT_PROTOCOL_VERSION),
                                    protocol: MinecraftServer.CURRENT_PROTOCOL_VERSION
                                },
                                players: {
                                    max: 1,
                                    online: 0,
                                    sample: []
                                },
                                description: {
                                    text: "2long2wait"
                                },
                                favicon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAQpSURBVHgB7VrtNe1AFD3eev/pABXQASpABagAFaACVIAKUAEqQAV0wK0gb3bWG+vcnTPJJJnc6ybZa81a92Mmydlz5nxmSUQyGTD+yMAxEiADx0iADBwjATJw/JUOsLKyIoeHh7KxsZF//v7+lpeXF3l+fpbPz09zDeZvbW3lny8uLoLzukCWajhhs8vLy6wMZ2dnhXVra2tTcz4+PpI9U8RIJ/zr62sWg5ubm/4RENp5CGPh5OSkXwR8fX1NCXF1dZVrhRfw/v5+6n/M7w0BMQKADCZpdXV17gQkcYOw8hqWBcect7e3qd/W19dl3khGwPX1deEzw+10Yd1vwExUzfn5oJov/BGowubmpjgvMfXb3d2d/BZ0yvDBwUHB+PEO98INWsOKDSAcBO41ARDIigot4XtHwN7eXkHlAQRCPjDqLQFIdBggQ4e9vSXg+Pi4IPzT05Op8r0jAAKw2t/e3tZaPy8CksQB7tznhQ8PhMIocCwCkhCghQdQ+VkUdFISg0Zsb2+XzkFitL+/b/6HnMEdg+Ba5BA7OzvJconW5+j8/DxrAhcimzYgBlWeJXZ0kg7PAqnumeQIuOpP/kC+qhuD9/f3n/oAjObR0VGeNC0vL1eunUwm4ryMpMCS/PeFQ8XYGJEWgKXf3d3NrbZugDw8PBTKYvjfRYv5Gqj+6emppADujVoDro8aQ5Oj0SjyQ5hbBm6AoBeg4YhIYsW50gSPVGd97SMAxp3wlX7ePYg4oX++w3BpVK2PBTRQo0lLrRZjvJMA8oCqBgh2XAMaVPfe1uAcJCb5ohE/Gfk8Q6scbo4kiMnxa/lhQ/WB2MGkogjT4Drxkzlis3axrAHC5JRFc7hO1W6i+xTajNjRyg2GGiChc8hJUsgOIJdALuAHAiQLHHjB+zRBLcY861C30A6FVJ21Q/cH9eA+orWzCWsIkqUcXBbjB2P3ablDNqjWUWP3xy33uRCAHgADD6rn4NxrQKP0/8gQGZamxBA5UwKsgmjISJZpCO9sSMCya8yUAAjEZ9Y/VMhG8O55L4FhxRmA9hjs/lqofzsC8CBWAAQBy3w8HwMtXCig0trEJKEXMXMCrDI4wGfaGqF4wvrdQ9sBTVLIk3RKgHXe8VB1DBELB43h88/fcX02ks73z5YAS3hEeHXDWq4jQjit2iCU4wYcFT4+7GU6JcAqXjYJPzHYkOHo6IaqN2xaU7DbbEDb5hO1CODYu636cVRo7ay+J89JkVHWygW4AcIvPdWFfkskdG0d3/OcVG+ZRLPF2VwMylJUPgYeOrCxUnCPBrl/Ow1oAmRyoWwO2aFV30fJ3MN6vc6vTfFCdS0Cmt6wrIlhvVLHae3j42NhTir1r90XQNeX3/crA0irqtTimqjt+aqyNT9mThOMjREZOEYCZOAYCZCBYyRABo5/aazlOLSOBHMAAAAASUVORK5CYII="
                            });
                            socket.write(clientboundStatusResponsePacket.pack());
                            break;
                        
                        case 0x01:
                            let serverboundPingPayload : bigint = serverboundPacket.readLong();
                            
                            let clientboundStatusPongPacket = new ClientboundPacket(ConnectionState.STATUS, 0x01);
                            clientboundStatusPongPacket.writeLong(serverboundPingPayload);
                            socket.write(clientboundStatusPongPacket.pack());
                            socket.end();
                            break;
                    }
                    
                    break;
                    
                case ConnectionState.LOGIN:
                    switch(serverboundPacket.id){
                        case 0x00:
                            let username = serverboundPacket.readString();
                            clientState.username = username;
                            
                            console.log(`${username} is attempting to log in...`);
                            
                            if(clientState.protocolVersion !== MinecraftServer.CURRENT_PROTOCOL_VERSION){
                                let clientboundLoginDisconnectPacket = new ClientboundPacket(ConnectionState.LOGIN, 0x00);
                                clientboundLoginDisconnectPacket.writeJSON([
                                    {
                                        color: "red",
                                        bold: true,
                                        text: "Invalid Version"
                                    },
                                    {
                                        color: "white",
                                        text: "\n\n"
                                    },
                                    {
                                        color: "red",
                                        bold: false,
                                        text: `Your client version (${MinecraftVersions.getVersionString(clientState.protocolVersion)}) does not match the 2long2wait server version (${MinecraftVersions.getVersionString(MinecraftServer.CURRENT_PROTOCOL_VERSION)}).`
                                    }
                                ]);
                                socket.write(clientboundLoginDisconnectPacket.pack());
                                socket.end();
                                
                                console.log(`${username} failed to log in: client-server protocol version mismatch.`);
                                break;
                            }
                            
                            let clientboundLoginSuccessPacket = new ClientboundPacket(ConnectionState.LOGIN, 0x02);
                            clientboundLoginSuccessPacket.writeString(uuid(`OfflinePlayer: ${username}`));
                            clientboundLoginSuccessPacket.writeString(username);
                            socket.write(clientboundLoginSuccessPacket.pack());
                            
                            console.log(`${username} has logged in successfully.`);
                            connectionState = ConnectionState.PLAY;
                            
                            let clientboundPlayJoinGamePacket = new ClientboundPacket(ConnectionState.PLAY, 0x23);
                            // Entity ID: 0
                            clientboundPlayJoinGamePacket.writeInt(0);
                            // Gamemode: 3 (spectator)
                            clientboundPlayJoinGamePacket.writeUnsignedByte(3);
                            // Dimension: 1 (The End)
                            clientboundPlayJoinGamePacket.writeInt(1);
                            // Difficulty: 2 (Normal)
                            clientboundPlayJoinGamePacket.writeUnsignedByte(2);
                            // Max Players: 1
                            clientboundPlayJoinGamePacket.writeUnsignedByte(1);
                            // World Level Type: default
                            clientboundPlayJoinGamePacket.writeString("default");
                            // Reduced Debug Info: (false - for testing, true - for production)
                            clientboundPlayJoinGamePacket.writeBoolean(false);
                            socket.write(clientboundPlayJoinGamePacket.pack());
                            
                            
                            let clientboundPlayPositionAndLookPacket = new ClientboundPacket(ConnectionState.PLAY, 0x2F);
                            // X, Y and Z
                            clientboundPlayPositionAndLookPacket.writeDouble(0);
                            clientboundPlayPositionAndLookPacket.writeDouble(1.62);
                            clientboundPlayPositionAndLookPacket.writeDouble(0);
                            // Yaw and Pitch
                            clientboundPlayPositionAndLookPacket.writeFloat(0);
                            clientboundPlayPositionAndLookPacket.writeFloat(0);
                            // Flags
                            clientboundPlayPositionAndLookPacket.writeByte(0x00);
                            clientboundPlayPositionAndLookPacket.writeVarInt(0);
                            socket.write(clientboundPlayPositionAndLookPacket.pack());
                            break;
                    }
                    
                    break;
                    
                case ConnectionState.PLAY:
                    switch(serverboundPacket.id){
                        case 0x0B:
                            let keepAliveId = serverboundPacket.readLong();
                            break;
                    }
                    break;
            }
        })
    }

}

class ClientState {
    
    waitingInQueue: boolean = true;
    protocolVersion: number;
    username: string;
    lastKeepAlive: {
        id: bigint,
        time: number
    };
    
    constructor() {
        this.lastKeepAlive = {
            id: null,
            time: new Date().getTime()
        };
    }
    
}