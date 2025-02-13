/*
 * Copyright 2021 The Kubeflow Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { useQuery } from 'react-query';
import { ApiJob } from 'src/apis/job';
import { ApiResourceType, ApiRunDetail } from 'src/apis/run';
import { RouteParams } from 'src/components/Router';
import { Apis } from 'src/lib/Apis';
import * as WorkflowUtils from 'src/lib/v2/WorkflowUtils';
import EnhancedRunDetails, { RunDetailsProps } from 'src/pages/RunDetails';
import { RunDetailsV2 } from 'src/pages/RunDetailsV2';

// Retrieve the recurring run ID from run if it is a run of recurring run
function getRecurringRunId(apiRun: ApiRunDetail | undefined): string | undefined {
  let recurringRunId;
  if (apiRun && apiRun.run?.resource_references) {
    apiRun.run.resource_references.forEach(value => {
      if (value.key?.type === ApiResourceType.JOB && value.key.id) {
        recurringRunId = value.key.id;
      }
    });
  }
  return recurringRunId;
}

// This is a router to determine whether to show V1 or V2 run detail page.
export default function RunDetailsRouter(props: RunDetailsProps) {
  const runId = props.match.params[RouteParams.runId];
  let recurringRunId: string | undefined;

  // Retrieves run detail.
  const { isSuccess: getRunSuccess, data: apiRun } = useQuery<ApiRunDetail, Error>(
    ['run_detail', { id: runId }],
    () => Apis.runServiceApi.getRun(runId),
    {},
  );

  // Get Recurring run ID (if it is existed) for retrieve recurring run detail (PipelineSpec IR).
  if (getRunSuccess && apiRun) {
    recurringRunId = getRecurringRunId(apiRun);
  }

  // Retrieves recurring run detail.
  const { isSuccess: getRecurringRunSuccess, data: apiRecurringRun } = useQuery<ApiJob, Error>(
    ['recurring_run_detail', { id: recurringRunId }],
    () => {
      if (!recurringRunId) {
        throw new Error('no Recurring run ID');
      }
      return Apis.jobServiceApi.getJob(recurringRunId);
    },
    { enabled: !!recurringRunId, staleTime: Infinity },
  );

  if (apiRun === undefined) {
    return <></>;
  }

  let pipelineManifestFromRecurringRun: string | undefined;
  let pipelineManifestFromRun: string | undefined;

  if (getRecurringRunSuccess && apiRecurringRun) {
    pipelineManifestFromRecurringRun = apiRecurringRun.pipeline_spec?.pipeline_manifest;
  }

  if (getRunSuccess && apiRun) {
    pipelineManifestFromRun = apiRun.run?.pipeline_spec?.pipeline_manifest;
  }

  let pipelineManifest = pipelineManifestFromRun
    ? pipelineManifestFromRun
    : pipelineManifestFromRecurringRun;

  if (getRunSuccess && apiRun && pipelineManifest) {
    // TODO(zijianjoy): We need to switch to use pipeline_manifest for new API implementation.
    const isV2Pipeline = WorkflowUtils.isPipelineSpec(pipelineManifest);
    if (isV2Pipeline) {
      return <RunDetailsV2 pipeline_job={pipelineManifest} runDetail={apiRun} {...props} />;
    }
  }

  return <EnhancedRunDetails {...props} />;
}
