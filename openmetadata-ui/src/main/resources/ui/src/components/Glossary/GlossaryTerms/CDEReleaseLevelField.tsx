/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { useTranslation } from 'react-i18next';
import {
  CDE_RELEASE_LEVEL,
  CDEReleaseLevel,
  getCDEReleaseLevelValue,
} from '../../../constants/CDEReleaseLevel.constants';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import CDEEnumField from './CDEEnumField';

interface CDEReleaseLevelFieldProps {
  glossaryTerm?: GlossaryTerm;
}

const CDEReleaseLevelField = ({
  glossaryTerm,
}: CDEReleaseLevelFieldProps) => {
  const { t } = useTranslation();
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const currentTerm = data ?? glossaryTerm;
  const value = getCDEReleaseLevelValue(currentTerm?.extension?.releaseLevel);
  const options = [
    {
      label: t('cde.release-level-ceo'),
      value: CDE_RELEASE_LEVEL.CEO,
    },
    {
      label: t('cde.release-level-ttqldl'),
      value: CDE_RELEASE_LEVEL.TTQLDL,
    },
  ];
  const isDraft =
    !currentTerm?.entityStatus ||
    currentTerm.entityStatus === EntityStatus.Draft;
  const canEdit =
    Boolean(currentTerm) &&
    isDraft &&
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const handleChange = async (releaseLevel: CDEReleaseLevel) => {
    if (currentTerm) {
      await onUpdate?.({
        ...currentTerm,
        extension: {
          ...(currentTerm.extension ?? {}),
          releaseLevel: [releaseLevel],
        },
      });
    }
  };

  return (
    <CDEEnumField
      canEdit={canEdit}
      className="cde-detail-field-release-level"
      editorTestId="cde-release-level-select"
      fieldTestId="cde-release-level"
      label={t('cde.release-level')}
      options={options}
      placeholder={t('cde.select-release-level')}
      value={value}
      valueClassName="cde-value-pill-release"
      valueTestId="cde-release-level-value"
      onChange={(selectedValue) =>
        handleChange(selectedValue as CDEReleaseLevel)
      }
    />
  );
};

export default CDEReleaseLevelField;
