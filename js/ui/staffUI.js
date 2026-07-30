// Staff tab: hire panels (one per role) + the hired-staff table (train/fire)

import { STAFF_MAX_LEVEL } from '../data/staffConfig.js';
import { getHireCost, staffTrainCost, staffTrainTime } from '../game/staffEconomy.js';

export const HIRE_ROLES = ['waiter', 'chef', 'cleaner', 'farmer', 'rancher', 'fisherman'];
export const ROLE_ICON = { waiter: '🤵', chef: '👨‍🍳', cleaner: '🧹', farmer: '👩‍🌾', rancher: '🐄', fisherman: '🎣' };
export const ROLE_LABEL = { waiter: 'Waiter', chef: 'Chef', cleaner: 'Cleaner', farmer: 'Farmer', rancher: 'Rancher', fisherman: 'Fisherman' };

// one horizontal panel per role: a filled slot for each staff member already hired,
// plus one locked slot showing the price to hire the next one
export function renderStaffPanels(game) {
  const container = document.getElementById('staffPanels');
  container.innerHTML = '';
  HIRE_ROLES.forEach(role => {
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

export function renderStaffTable(game) {
  const tbody = document.querySelector('#staffTable tbody');
  tbody.innerHTML = '';
  game.staff.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td><td>${ROLE_ICON[s.role]} ${s.role}</td><td>Lvl ${s.level}/${STAFF_MAX_LEVEL}</td><td></td><td></td>`;

    const trainCell = tr.children[3];
    if (s.training) {
      const secsLeft = Math.max(0, Math.ceil(s.training.remaining / 1000));
      trainCell.textContent = `Training… ${secsLeft}s`;
    } else if (s.level >= STAFF_MAX_LEVEL) {
      trainCell.textContent = 'Max level';
    } else {
      const cost = staffTrainCost(s.level);
      const trainBtn = document.createElement('button');
      trainBtn.textContent = `🎓 Train ($${cost}, ${Math.round(staffTrainTime(s.level) / 1000)}s)`;
      trainBtn.className = 'smallBtn';
      trainBtn.disabled = game.money < cost;
      trainBtn.addEventListener('click', () => game.trainStaff(s.id));
      trainCell.appendChild(trainBtn);
    }

    const fireBtn = document.createElement('button');
    fireBtn.textContent = 'Fire';
    fireBtn.className = 'smallBtn';
    fireBtn.addEventListener('click', () => game.fireStaff(s.id));
    tr.children[4].appendChild(fireBtn);

    tbody.appendChild(tr);
  });
}
