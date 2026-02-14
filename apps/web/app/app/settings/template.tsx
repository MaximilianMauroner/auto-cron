export default function SettingsTemplate({ children }: { children: React.ReactNode }) {
	return (
		<div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out fill-mode-both">
			{children}
		</div>
	);
}
