// Staff tab: one panel per role — hired staff as cells (train/fire live inside each cell)
// plus one locked cell showing the price to hire the next one

import { getHireCost, staffTrainCost, staffTrainTime } from '../game/staffEconomy.js';

export const HIRE_ROLES = ['waiter', 'chef', 'farmer', 'rancher', 'fisherman'];
export const ROLE_ICON = { waiter: '🤵', chef: '👨‍🍳', farmer: '👩‍🌾', rancher: '🐄', fisherman: '🎣' };
export const ROLE_LABEL = { waiter: 'Waiter', chef: 'Chef', farmer: 'Farmer', rancher: 'Rancher', fisherman: 'Fisherman' };

// rancher/fisherman are gated behind restaurant level (see data/levels.js) — reuses
// game.unlockedObjectTypes for role names too, no collision with any object `type` string
export const GATED_ROLES = new Set(['rancher', 'fisherman']);

export function renderStaffPanels(game) {
  const container = document.getElementById('staffPanels');
  container.innerHTML = '';
  HIRE_ROLES.forEach(role => {
    if (GATED_ROLES.has(role) && !game.unlockedObjectTypes.has(role)) return;
    const hired = game.staff.filter(s => s.role === role);
    const cost = getHireCost(game, role);

    const panel = document.createElement('div');
    panel.className = 'rolePanel';

    const header = document.createElement('div');
    header.className = 'rolePanelHeader';
    header.textContent = `${ROLE_ICON[role]} ${ROLE_LABEL[role]}`;
    panel.appendChild(header);

    const slots = document.createElement('div');
    slots.className = 'rolePanelSlots';

    hired.forEach(s => {
      const slot = document.createElement('div');
      slot.className = 'staffSlot filled';
      slot.innerHTML = `<span class="slotIcon">${ROLE_ICON[role]}</span><span class="slotName">${s.name}</span><span class="slotLevel">Lvl ${s.level}</span>`;

      const actions = document.createElement('div');
      actions.className = 'slotActions';

      if (s.training) {
        const secsLeft = Math.max(0, Math.ceil(s.training.remaining / 1000));
        const trainingText = document.createElement('span');
        trainingText.className = 'slotTrainingText';
        trainingText.textContent = `⏳ ${secsLeft}s`;
        actions.appendChild(trainingText);
      } else {
        const trainCost = staffTrainCost(s.level);
        const trainBtn = document.createElement('button');
        trainBtn.className = 'slotBtn';
        trainBtn.textContent = `🎓$${trainCost}`;
        trainBtn.title = `Train — ${Math.round(staffTrainTime(s.level) / 1000)}s`;
        trainBtn.disabled = game.money < trainCost;
        trainBtn.addEventListener('click', () => game.trainStaff(s.id));
        actions.appendChild(trainBtn);
      }

      const fireBtn = document.createElement('button');
      fireBtn.className = 'slotBtn slotFireBtn';
      fireBtn.textContent = '✕';
      fireBtn.title = 'Fire';
      fireBtn.addEventListener('click', () => game.fireStaff(s.id));
      actions.appendChild(fireBtn);

      slot.appendChild(actions);
      slots.appendChild(slot);
    });

    const lockedSlot = document.createElement('div');
    const affordable = game.money >= cost;
    lockedSlot.className = 'staffSlot locked' + (affordable ? '' : ' disabled');
    lockedSlot.innerHTML = `<span class="slotIcon">🔒</span><span class="slotCost">$${cost}</span>`;
    lockedSlot.addEventListener('click', () => game.hireStaff(role));
    slots.appendChild(lockedSlot);

    panel.appendChild(slots);
    container.appendChild(panel);
  });
}
