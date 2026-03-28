import { Game } from '@/core/Game';

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container element not found');
  }

  const game = await Game.create(container);
  game.start();
}

main().catch((err) => {
  console.error('Failed to start game:', err);
});
