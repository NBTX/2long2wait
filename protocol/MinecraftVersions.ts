export default class MinecraftVersions {
    
    static getVersionString(protocolVersion: number){
        switch (protocolVersion){
            case 340:
                return "1.12.2";
        
            default:
                return `Unknown/Unsupported Version (${protocolVersion})`;
        }
    }
    
}