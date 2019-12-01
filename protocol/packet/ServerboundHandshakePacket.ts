import {ConnectionState, ServerboundPacket} from "./Packet";
import MinecraftVersions from "../MinecraftVersions";

export default class ServerboundHandshakePacket {

    readonly protocolVersion: number;
    readonly address: string;
    readonly port: number;
    readonly nextConnectionState: ConnectionState;
    
    get protocolVersionString() : string {
        return MinecraftVersions.getVersionString(this.protocolVersion);
    }
    
    constructor(protocolVersion: number, address: string, port: number, nextConnectionState: ConnectionState) {
        this.protocolVersion = protocolVersion;
        this.address = address;
        this.port = port;
        this.nextConnectionState = nextConnectionState;
    }
    
    static contextualize(packet: ServerboundPacket) : ServerboundHandshakePacket {
        let protocolVersion = packet.readVarInt();
        let address = packet.readString();
        let port = packet.readShort();
        let nextConnectionState = packet.readVarInt();
        
        return new ServerboundHandshakePacket(protocolVersion, address, port, nextConnectionState);
    }
    
}