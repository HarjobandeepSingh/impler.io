/* eslint-disable no-magic-numbers */
import { subMonths, subWeeks, subYears } from 'date-fns';

import { TemplateRepository } from '../template';
import { BaseRepository } from '../base-repository';
import { UploadEntity } from './upload.entity';
import { Upload } from './upload.schema';

export class UploadRepository extends BaseRepository<UploadEntity> {
  private templateRepository: TemplateRepository;
  constructor() {
    super(Upload, UploadEntity);
    this.templateRepository = new TemplateRepository();
  }

  async getUploadInformation(uploadId: string): Promise<UploadEntity> {
    return await Upload.findById(uploadId).populate('_allDataFileId', 'path name');
  }
  async getUploadInvalidDataInformation(uploadId: string): Promise<UploadEntity> {
    return await Upload.findById(uploadId).populate('_invalidDataFileId', 'path name');
  }
  async getUploadProcessInformation(uploadId: string): Promise<UploadEntity> {
    return await Upload.findById(uploadId)
      .populate('_uploadedFileId', 'path originalName')
      .populate('_invalidDataFileId', 'path name')
      .populate('_validDataFileId', 'path name');
  }
  async getUploadWithTemplate(uploadId: string, fields: string[]): Promise<UploadEntity> {
    return await Upload.findById(uploadId).populate('_templateId', fields.join(' '));
  }
  async getStats(_projectId: string) {
    const now: number = Date.now();
    const yearBefore = subYears(now, 1);
    const monthBefore = subMonths(now, 1);
    const weekBefore = subWeeks(now, 1);

    const templateIds = await this.templateRepository.getProjectTemplateIds(_projectId);

    const result = await this.aggregate([
      {
        $match: {
          _templateId: {
            $in: templateIds,
          },
          createdAt: {
            $gte: yearBefore,
          },
        },
      },
      {
        $group: {
          _id: null,
          yearly: {
            $sum: 1,
          },
          monthly: {
            $sum: {
              $cond: [
                {
                  $gte: ['$createdAt', monthBefore],
                },
                1,
                0,
              ],
            },
          },
          weekly: {
            $sum: {
              $cond: [
                {
                  $gte: ['$createdAt', weekBefore],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = result[0] || {};

    return {
      yearly: stats.yearly || 0,
      monthly: stats.monthly || 0,
      weekly: stats.weekly || 0,
    };
  }

  async getStatsFeed(_projectId: string, days: number) {
    const now: number = Date.now();
    const daysBefore = subWeeks(now, days);

    const templateIds = await this.templateRepository.getProjectTemplateIds(_projectId);

    const result = await this.aggregate([
      {
        $match: {
          _templateId: {
            $in: templateIds,
          },
          createdAt: {
            $gte: daysBefore,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    return result;
  }
}
