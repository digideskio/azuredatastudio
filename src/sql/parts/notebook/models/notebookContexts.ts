/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import { localize } from 'vs/nls';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IDefaultConnection, notebookConstants, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';

export class NotebookContexts {
	private static MSSQL_PROVIDER = 'MSSQL';

	private static get DefaultContext(): IDefaultConnection {
		let defaultConnection: IConnectionProfile = <any>{
			providerName: NotebookContexts.MSSQL_PROVIDER,
			id: '-1',
			serverName: localize('selectConnection', 'Select connection')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: defaultConnection,
			otherConnections: [defaultConnection]
		};
	}

	private static get LocalContext(): IDefaultConnection {
		let localConnection: IConnectionProfile = <any>{
			providerName: NotebookContexts.MSSQL_PROVIDER,
			id: '-1',
			serverName: localize('localhost', 'Localhost')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: localConnection,
			otherConnections: [localConnection]
		};
	}

	/**
	 * Get all of the applicable contexts for a given kernel
	 * @param apiWrapper ApiWrapper
	 * @param kernelChangedArgs kernel changed args (both old and new kernel info)
	 * @param profile current connection profile
	 */
	public static async getContextsForKernel(connectionService: IConnectionManagementService, connProviderIds: string[], kernelChangedArgs?: nb.IKernelChangedArgs, profile?: IConnectionProfile): Promise<IDefaultConnection> {
		let connections: IDefaultConnection = this.DefaultContext;
		if (!profile) {
			if (!kernelChangedArgs || !kernelChangedArgs.newValue ||
				(kernelChangedArgs.oldValue && kernelChangedArgs.newValue.id === kernelChangedArgs.oldValue.id)) {
				// nothing to do, kernels are the same or new kernel is undefined
				return connections;
			}
		}
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name && connProviderIds.length < 1) {
			return connections;
		} else {
			connections = await this.getActiveContexts(connectionService, connProviderIds, profile);
		}
		return connections;
	}

	/**
	 * Get all active contexts and sort them
	 * @param apiWrapper ApiWrapper
	 * @param profile current connection profile
	 */
	public static async getActiveContexts(connectionService: IConnectionManagementService, connProviderIds: string[], profile: IConnectionProfile): Promise<IDefaultConnection> {
		let defaultConnection: IConnectionProfile = NotebookContexts.DefaultContext.defaultConnection;
		let activeConnections: IConnectionProfile[] = await connectionService.getActiveConnections();
		// If no connections exist, only show 'n/a'
		if (activeConnections && activeConnections.length > 0) {
			activeConnections = activeConnections.filter(conn => conn.id !== '-1');
		}
		if (activeConnections.length === 0) {
			if (connProviderIds.length === 0) {
				return NotebookContexts.LocalContext;
			}
			return NotebookContexts.DefaultContext;
		}

		// If launched from the right click or server dashboard, connection profile data exists, so use that as default
		// if (profile && profile.options) {
		// 	let profileConnection = activeConnections.filter(conn => conn.serverName === profile.serverName);
		// 	if (profileConnection) {
		// 		let connections = profileConnection.filter(connection => connection.providerName in connProviderIds);
		// 		if (connections && connections.length > 0) {
		// 			defaultConnection = connections[0];
		// 		}
		// 	}
		// } else {
		if (activeConnections.length > 0) {
			let connections = activeConnections.filter(connection => {
				return connProviderIds.includes(connection.providerName);
			});
			if (connections && connections.length > 0) {
				defaultConnection = connections[0];
				if (profile && profile.options) {
					if (connections.find(connection => connection.serverName === profile.serverName)) {
						defaultConnection = connections.find(connection => connection.serverName === profile.serverName);
					}
				}
			}
			activeConnections = [];
			connections.forEach(connection => activeConnections.push(connection));
		}
		if (defaultConnection === NotebookContexts.DefaultContext.defaultConnection) {
			let newConnection = <IConnectionProfile><any>{
				providerName: 'SQL',
				id: '-2',
				serverName: localize('addConnection', 'Add new connection')
			};
			activeConnections.push(newConnection);
		}

		return {
			otherConnections: activeConnections,
			defaultConnection: defaultConnection
		};
	}

	/**
	 *
	 * @param specs kernel specs (comes from session manager)
	 * @param connectionInfo connection profile
	 * @param savedKernelInfo kernel info loaded from
	 */
	public static getDefaultKernel(specs: nb.IAllKernels, connectionInfo: IConnectionProfile, savedKernelInfo: nb.IKernelInfo, notificationService: INotificationService): nb.IKernelSpec {
		let savedKernel: nb.IKernelSpec;
		let defaultKernel: nb.IKernelSpec;
		if (specs) {
			defaultKernel = specs.kernels.find((kernel) => kernel.name === specs.defaultKernel);
			if (savedKernelInfo) {
				savedKernel = specs.kernels.find((kernel) => kernel.name === savedKernelInfo.name);
			}
		}
		if (specs && connectionInfo) {
			// set default kernel to default kernel not saved previously
			// otherwise, set default to kernel info loaded from existing file
			defaultKernel = !savedKernel ? defaultKernel : savedKernel;
		}

		// If no default kernel specified (should never happen), default to SQL
		if (!defaultKernel) {
			defaultKernel = {
				name: notebookConstants.SQL,
				display_name: notebookConstants.SQL
			};
		}
		return defaultKernel;
	}
}

export interface IKernelJupyterID {
	id: string;
	jupyterId: string;
}
