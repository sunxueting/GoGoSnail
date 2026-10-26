// Collision and physics are required for the game; debug geometry is not.
var physicsManager = cc.director.getPhysicsManager();
physicsManager.enabled = true;
cc.director.getCollisionManager().enabled = true;
physicsManager.enabledDebugDraw = false;
physicsManager.debugDrawFlags = 0;
