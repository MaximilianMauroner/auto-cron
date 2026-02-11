type EnvRecord = Record<string, string | undefined>;

export const env = (): EnvRecord => {
	const maybeProcess = globalThis as { process?: { env?: EnvRecord } };
	return maybeProcess.process?.env ?? {};
};
