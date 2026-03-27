// --- 1. 配置区域 (Config) ---

import type { MrppEditor } from '../types/mrpp.js';

// 角色定义
export const ROLES = {
	ROOT: 'root',
	ADMIN: 'admin',
	MANAGER: 'manager',
	USER: 'user',
	GUEST: 'guest'
} as const;

// 权限定义
export const ABILITIES = {
	UI_ADVANCED: 'ui.advanced', // 高级面板
	FEATURE_ADVANCED: 'feature.advanced', // 高级功能
} as const;

type Role = typeof ROLES[keyof typeof ROLES];
type Ability = typeof ABILITIES[keyof typeof ABILITIES];

// 权限配置表
export const ROLE_ABILITY: Record<string, Ability[]> = {
	[ROLES.GUEST]: [
		// 访客权限
	],
	[ROLES.USER]: [
		// 普通用户权限
	],
	[ROLES.MANAGER]: [
		// Manager 权限
		ABILITIES.UI_ADVANCED,
		ABILITIES.FEATURE_ADVANCED
	],
	[ROLES.ADMIN]: [
		// Admin 拥有 Manager 的所有权限 + 高级权限
		ABILITIES.UI_ADVANCED,
		ABILITIES.FEATURE_ADVANCED
	],
};

// --- 2. 逻辑区域 (Manager) ---

export class Access {

	editor: MrppEditor;

	constructor(editor: MrppEditor) {
		this.editor = editor;
	}

	// 获取当前角色
	get role(): Role {
		return this.editor.data?.user?.role || ROLES.GUEST;
	}

	/**
	 * 权限判断：能不能做某事？
	 */
	can(ability: string): boolean {
		// Root 拥有无限权限
		if (this.role === ROLES.ROOT) return true;

		const list = ROLE_ABILITY[this.role] || [];
		return list.includes(ability as Ability);
	}

	/**
	 * 身份判断：是不是某角色？
	 */
	is(role: string): boolean {
		return this.role === role;
	}

	/**
	 * 权重判断：是否包含某角色及以上
	 */
	atLeast(role: string): boolean {
		const levels: Role[] = [ROLES.GUEST, ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, ROLES.ROOT];
		return levels.indexOf(this.role) >= levels.indexOf(role as Role);
	}
}
