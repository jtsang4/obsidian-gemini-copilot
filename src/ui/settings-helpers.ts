import { Setting } from 'obsidian';
import type ObsidianGemini from '../main';
import type { ObsidianGeminiSettings } from '../main';
import { GEMINI_MODELS } from '../models';

type StringKeys<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends string ? K : never;
}[keyof T];

export async function selectModelSetting(
  containerEl: HTMLElement,
  plugin: InstanceType<typeof ObsidianGemini>,
  settingName: StringKeys<ObsidianGeminiSettings>,
  label: string,
  description: string
) {
  // Get available models (dynamic if enabled, static otherwise)
  const availableModels =
    plugin.settings.modelDiscovery?.enabled && plugin.getModelManager
      ? await plugin.getModelManager().getAvailableModels()
      : GEMINI_MODELS;

  const _dropdown = new Setting(containerEl)
    .setName(label)
    .setDesc(description)
    .addDropdown((dropdown) => {
      // Add all models from the available list
      availableModels.forEach((model) => {
        dropdown.addOption(model.value, model.label);
      });

      const current = (plugin.settings as ObsidianGeminiSettings)[
        settingName
      ] as unknown as string | undefined;
      dropdown.setValue(current ?? '').onChange(async (value) => {
        (plugin.settings as ObsidianGeminiSettings)[settingName] = value as string;
        await plugin.saveSettings();
      });
      return dropdown;
    });
}
