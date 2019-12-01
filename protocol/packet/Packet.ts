export enum ConnectionState {
    HANDSHAKE,
    STATUS,
    LOGIN,
    PLAY
}

export class ClientboundPacket {
    
    private payload: Array<number>;
    
    readonly state: ConnectionState;
    readonly id: number;
    
    constructor(state: ConnectionState, id: number) {
        this.payload = [];
        
        this.state = state;
        this.id = id;
        this.writeVarInt(id);
    }
    
    writeVarInt (value: number, prepend: boolean = false) : void {
        let result = [];
        
        do {
            let temp : number = value & 0b01111111;
            value >>>= 7;
            if(value != 0){
                temp |= 0b10000000;
            }
            
            result.push(temp);
        } while (value != 0);
        
        if(prepend) this.payload = [...result, ...this.payload];
        else this.payload = [...this.payload, ...result];
    }
    
    writeVarLong (value: number) {
        this.writeVarInt(value);
    }
    
    writeLong (value: bigint) {
        let buffer = Buffer.alloc(8);
        buffer.writeBigInt64BE(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    writeString (string: string) : void {
        this.writeVarInt(string.length);
        this.payload = this.payload.concat(Buffer.from(string, 'utf8').toJSON().data);
    }
    
    writeJSON (data: any) : void {
        this.writeString(JSON.stringify(data));
    }
    
    writeBoolean (value: boolean) : void {
        this.payload = this.payload.concat(value ? 0x01 : 0x00);
    }
    
    writeInt (value: number) : void {
        let buffer = Buffer.alloc(4);
        buffer.writeInt32BE(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    writeDouble (value: number) : void {
        let buffer = Buffer.alloc(8);
        buffer.writeDoubleBE(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    writeUnsignedByte (value: number) {
        let buffer = Buffer.alloc(1);
        buffer.writeUInt8(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    writeByte (value: number) {
        let buffer = Buffer.alloc(1);
        buffer.writeInt8(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    writeFloat (value: number) {
        let buffer = Buffer.alloc(4);
        buffer.writeFloatBE(value, 0);
        this.payload = this.payload.concat(buffer.toJSON().data);
    }
    
    pack () : Buffer {
        this.writeVarInt(this.payload.length, true);
        return Buffer.from(this.payload);
    }
    
}

export class ServerboundPacket {

    private data: Buffer;
    
    readonly connectionState: ConnectionState;
    
    // The length of the packet ID from the packet header, decoded from
    // VarInt form.
    readonly packetLength: number;
    // The packet ID.
    readonly id: number;
    // The offset of the data after the packet header (length and ID) have been read.
    readonly payloadOffset: number;
    // The CURRENT offset of the pointer
    pointerOffset: number;
    
    constructor (data: Buffer, connectionState: ConnectionState) {
        this.pointerOffset = 0;
        
        this.data = data;
        this.connectionState = connectionState;
        
        this.packetLength = this.readVarInt();
        let trueLength: number = this.data.byteLength - this.pointerOffset;
        
        this.id = this.readVarInt();
        this.payloadOffset = this.pointerOffset;
        
        if((trueLength) !== this.packetLength && !this.isNonConformant){
            console.error(`Identified malformed packet: [${ConnectionState[this.connectionState]}: ${this.id.toString(16)}]. (True packet length (${trueLength}) does not match reported packet length (${this.packetLength}).)`);
            console.error(this);
        }
    }
    
    get isNonConformant () : boolean {
        return (this.connectionState == ConnectionState.HANDSHAKE && this.id == 0xFE);
    }
    
    toBuffer (){
        this.pointerOffset += this.payloadOffset;
        return this.data.slice(this.payloadOffset);
    }

    toString (){
        this.pointerOffset += this.payloadOffset;
        return this.data.toString('utf8', this.payloadOffset);
    }
    
    readVarInt () : number {
        let bytesRead: number = 0;
        let result: number = 0;
        
        let read: number;
        do {
            read = this.data.readIntLE(this.pointerOffset,1);
            this.pointerOffset++;
            let value: number = (read & 0b01111111);
            result |= (value << (7 * bytesRead));
    
            bytesRead++;
            if(bytesRead > 5){
                throw new Error("Attempted to read malformed VarInt (size > 5)");
            }
        // Once the most significant bit is set, we know that the
        // VarInt has been read.
        } while ((read & 0b10000000) != 0);
        
        return result;
    }
    
    readVarLong () : number {
        let bytesRead: number = 0;
        let result: number = 0;
    
        let read: number;
        do {
            read = this.data.readIntLE(this.pointerOffset,1);
            this.pointerOffset++;
            let value: number = (read & 0b01111111);
            result |= (value << (7 * bytesRead));
        
            bytesRead++;
            if(bytesRead > 10){
                throw new Error("Attempted to read malformed VarLong (size > 10)");
            }
            // Once the most significant bit is set, we know that the
            // VarInt has been read.
        } while ((read & 0b10000000) != 0);
    
        return result;
    }
    
    readLong () : bigint {
        let payload: bigint = this.data.readBigInt64BE(this.pointerOffset);
        this.pointerOffset += 4;
        return payload;
    }
    
    readDouble () : number {
        let payload: number = this.data.readDoubleBE(this.pointerOffset);
        this.pointerOffset += 8;
        return payload;
    }
    
    readShort () : number {
        let payload: number = this.data.readInt16BE(this.pointerOffset);
        this.pointerOffset += 2;
        return payload;
    }
    
    readString () : string {
        let length: number = this.readVarInt();
        let payload: string = this.data.slice(this.pointerOffset, this.pointerOffset + length).toString('utf8');
        this.pointerOffset += length;
        
        return payload;
    }
    
}
    
