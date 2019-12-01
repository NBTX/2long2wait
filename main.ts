import MinecraftServer from "./protocol/MinecraftServer";
import Ora from 'ora';

(async () => {
    
    const loader = Ora().start("Initializing...");
    
    const server = new MinecraftServer(25565);
    await server.start();
    loader.info("Minecraft server listening on 25565...").start("Initializing...");
    
    loader.succeed("2long2wait is ready!");
    
})();