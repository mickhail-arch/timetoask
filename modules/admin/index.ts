// modules/admin/index.ts — Admin module barrel export
export {
  getDashboard,
  getUsers,
  getUserById,
  updateUser,
  getTools,
  getToolById,
  updateTool,
  getLogs,
} from './admin.service';
export type { DashboardStats } from './admin.service';
